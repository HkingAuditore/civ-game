                // 应用官员贪婪度修正：贪婪度直接放大财富弹性，意味着越有钱越想通过消费展示
                if (key === 'official') {
                    wealthElasticity *= officialGreedModifier;
                }

                const maxMultiplier = Math.max(1, (def.maxConsumptionMultiplier || 6) + getMaxConsumptionMultiplierBonus(difficulty));
                const wealthMultiplier = calculateWealthMultiplier(wealthRatio, wealthRatio, wealthElasticity, maxMultiplier);
                // 记录财富乘数（取最后一次计算的值，用于UI显示）
                if (!stratumWealthMultipliers[key] || Math.abs(wealthMultiplier - 1) > Math.abs(stratumWealthMultipliers[key] - 1)) {
                    stratumWealthMultipliers[key] = wealthMultiplier;
                }

                // 2. 价格影响：当前价格相对于基础价格的变化
                const currentPrice = getPrice(resKey);
                const basePrice = resourceInfo.basePrice || 1;
                const priceRatio = currentPrice / basePrice;
                // 价格变化对需求的影响：价格上涨→需求下降，价格下跌→需求上涨
                // 使用需求弹性：价格变化1%，需求反向变化elasticity%
                const priceMultiplier = Math.pow(priceRatio, -demandElasticity);

                // 3. 每日随机浮动（80%-120%）
                const dailyVariation = 0.8 + Math.random() * 0.4;

                // 综合调整需求
                requirement *= wealthMultiplier * priceMultiplier * dailyVariation;

                // 确保需求不会变成负数或过大
                requirement = Math.max(0, requirement);
                requirement = Math.min(requirement, perCapita * count * needsRequirementMultiplier * 8); // 最多8倍（配合更低的财富乘数上限）
            }
            const available = res[resKey] || 0;
            let satisfied = 0;

            if (isTradableResource(resKey)) {
                const marketPrice = getPrice(resKey);

                // [NEW] 价格管制检查：只有左派主导且启用时才生效
                const leftFactionDominant = cabinetStatus?.dominance?.panelType === 'plannedEconomy';
                const priceControlActive = leftFactionDominant && priceControls?.enabled && priceControls.governmentSellPrices?.[resKey] !== undefined && priceControls.governmentSellPrices[resKey] !== null;

                // Determine tentative effective price for affordability check
                // Note: If treasury runs out during application, we revert to market price,
                // but we calculate consumption based on the hope of government price.
                let tentativePrice = marketPrice;
                if (priceControlActive) {
                    tentativePrice = priceControls.governmentSellPrices[resKey];
                }

                const priceWithTax = tentativePrice * (1 + getResourceTaxRate(resKey));
                const affordable = priceWithTax > 0 ? Math.min(requirement, (wealth[key] || 0) / priceWithTax) : requirement;
                const amount = Math.min(requirement, available, affordable);

                // 先不统计需求，等实际消费后再统计
                if (amount > 0) {
                    res[resKey] = available - amount;
                    rates[resKey] = (rates[resKey] || 0) - amount;

                    // [NEW] Apply Price Control (Financial Transaction)
                    let finalEffectivePrice = marketPrice;
                    if (priceControlActive) {
                        const pcResult = applyBuyPriceControl({
                            resourceKey: resKey,
                            amount,
                            marketPrice,
                            priceControls,
                            taxBreakdown,
                            resources: res
                        });
                        // If success (treasury sufficient for subsidy), use gov price
                        // If fail (treasury empty), it returns marketPrice
                        finalEffectivePrice = pcResult.effectivePrice;
                    }

                    const taxRate = getResourceTaxRate(resKey);
                    const baseCost = amount * finalEffectivePrice;
                    const taxPaid = baseCost * taxRate;
                    let totalCost = baseCost;

                    if (taxPaid < 0) {
                        const subsidyAmount = Math.abs(taxPaid);
                        if ((res.silver || 0) >= subsidyAmount) {
                            res.silver -= subsidyAmount;
                            taxBreakdown.subsidy += subsidyAmount;
                            totalCost -= subsidyAmount;
                            // Record consumption subsidy as income
                            roleWagePayout[key] = (roleWagePayout[key] || 0) + subsidyAmount;
                            roleLaborIncome[key] = (roleLaborIncome[key] || 0) + subsidyAmount; // Subsidy is personal income
                            // [FIX] 同步到 classFinancialData 以保持概览和财务面板数据一致
                            if (classFinancialData[key]) {
                                classFinancialData[key].income.subsidy = (classFinancialData[key].income.subsidy || 0) + subsidyAmount;
                            }
                        } else {
                            if (tick % 20 === 0) {
                                recordAggregatedLog(`国库空虚，无法为 ${STRATA[key]?.name || key} 支付 ${RESOURCES[resKey]?.name || resKey} 消费补贴！`);
                            }
                        }
                    } else if (taxPaid > 0) {
                        taxBreakdown.industryTax += taxPaid;
                        totalCost += taxPaid;
                    }

                    wealth[key] = Math.max(0, (wealth[key] || 0) - totalCost);
                    roleExpense[key] = (roleExpense[key] || 0) + totalCost;
                    roleLivingExpense[key] = (roleLivingExpense[key] || 0) + totalCost; // Needs consumption is living expense
                    satisfied = amount;

                    // 统计实际消费的需求量，而不是原始需求量
                    demand[resKey] = (demand[resKey] || 0) + amount;

                    // NEW: Track consumption by stratum
                    if (!stratumConsumption[key]) stratumConsumption[key] = {};
                    stratumConsumption[key][resKey] = (stratumConsumption[key][resKey] || 0) + amount;

                    if (classFinancialData[key]) {
                        // 分类记录：baseNeeds 中的资源是必需品，其他是奢侈品
                        // 存储 { cost, quantity, price } 以便 UI 显示详情
                        const needEntry = {
                            cost: totalCost,
                            quantity: amount,
                            price: finalEffectivePrice
                        };

                        if (def.needs && def.needs.hasOwnProperty(resKey)) {
                            // 必需品消费
                            classFinancialData[key].expense.essentialNeeds = classFinancialData[key].expense.essentialNeeds || {};
                            const existing = classFinancialData[key].expense.essentialNeeds[resKey];
                            if (existing && typeof existing === 'object') {
                                existing.cost += totalCost;
                                existing.quantity += amount;
                            } else {
                                classFinancialData[key].expense.essentialNeeds[resKey] = needEntry;
                            }
                        } else {
                            // 奢侈品消费
                            classFinancialData[key].expense.luxuryNeeds = classFinancialData[key].expense.luxuryNeeds || {};
                            const existing = classFinancialData[key].expense.luxuryNeeds[resKey];
                            if (existing && typeof existing === 'object') {
                                existing.cost += totalCost;
                                existing.quantity += amount;
                            } else {
                                classFinancialData[key].expense.luxuryNeeds[resKey] = needEntry;
                            }
                        }

                        // Also track transaction tax component for needs
                        // Note: taxBreakdown.industryTax is updated above for positive tax
                        // taxPaid was calculated above
                        if (taxPaid > 0) {
                            classFinancialData[key].expense.transactionTax = (classFinancialData[key].expense.transactionTax || 0) + taxPaid;
                        }
                    }
                }

                // 记录短缺原因
                const ratio = requirement > 0 ? satisfied / requirement : 1;
                satisfactionSum += ratio;
                tracked += 1;
                if (ratio < 0.99) {
                    // 判断短缺原因：买不起 vs 缺货
                    const canAfford = affordable >= requirement * 0.99;
                    const inStock = available >= requirement * 0.99;
                    let reason = 'both'; // 既缺货又买不起
                    if (canAfford && !inStock) {
                        reason = 'outOfStock'; // 有钱但缺货
                    } else if (!canAfford && inStock) {
                        reason = 'unaffordable'; // 有货但买不起
                    }
                    shortages.push({ resource: resKey, reason });
                }
            } else {
                const amount = Math.min(requirement, available);
                if (amount > 0) {
                    res[resKey] = available - amount;
                    satisfied = amount;
                }

                const ratio = requirement > 0 ? satisfied / requirement : 1;
                satisfactionSum += ratio;
                tracked += 1;
                if (ratio < 0.99) {
                    // 非交易资源只可能是缺货
                    shortages.push({ resource: resKey, reason: 'outOfStock' });
                }
            }
        }

        needsReport[key] = {
            satisfactionRatio: tracked > 0 ? satisfactionSum / tracked : 1,
            totalTrackedNeeds: tracked,
        };
        classShortages[key] = shortages;
    });

    // 计算劳动效率，特别关注食物和布料的基础需求
    let workforceNeedWeighted = 0;
    let workforceTotal = 0;
    let basicNeedsDeficit = 0; // 基础需求缺失的严重程度

    Object.keys(STRATA).forEach(key => {
        const count = popStructure[key] || 0;
        if (count <= 0) return;
        workforceTotal += count;
        const needLevel = needsReport[key]?.satisfactionRatio ?? 1;
        workforceNeedWeighted += needLevel * count;

        // 检查食物和布料的基础需求满足情况
        const def = STRATA[key];
        if (def && def.needs) {
            const shortages = classShortages[key] || [];
            const hasBasicShortage = shortages.some(s => s.resource === 'food' || s.resource === 'cloth');

            if (hasBasicShortage) {
                // 基础需求未满足，累计缺失人口数
                basicNeedsDeficit += count;
            }
        }
    });

    const laborNeedAverage = workforceTotal > 0 ? workforceNeedWeighted / workforceTotal : 1;
    let laborEfficiencyFactor = 0.3 + 0.7 * laborNeedAverage;

    // 如果有基础需求缺失，额外降低效率
    if (basicNeedsDeficit > 0 && workforceTotal > 0) {
        const basicDeficitRatio = basicNeedsDeficit / workforceTotal;
        // 基础需求缺失导致额外的效率惩罚：最多额外降低40%效率
        const basicPenalty = basicDeficitRatio * 0.4;
        laborEfficiencyFactor = Math.max(0.1, laborEfficiencyFactor - basicPenalty);

        if (basicDeficitRatio > 0.1) {
            logs.push(`基础需求（食物/布料）严重短缺，劳动效率大幅下降！`);
        }
    }

    if (laborEfficiencyFactor < 0.999) {
        Object.entries(rates).forEach(([resKey, value]) => {
            const resInfo = RESOURCES[resKey];
            if (!resInfo || resKey === 'silver' || (resInfo.type && resInfo.type === 'virtual')) return;
            if (value > 0) {
                const reduction = value * (1 - laborEfficiencyFactor);
                rates[resKey] = value - reduction;
                res[resKey] = Math.max(0, (res[resKey] || 0) - reduction);
            }
        });
        // logs.push('劳动力因需求未满足而效率下降。');
    }

    // Decree approval modifiers now come from `activeDecrees` (timed system)
    const decreesFromActiveForApproval = activeDecrees
        ? Object.entries(activeDecrees).map(([id, data]) => ({
            id,
            active: true,
            modifiers: data?.effects || data?.modifiers
        }))
        : [];

    let decreeApprovalModifiers = calculateDecreeApprovalModifiers(decreesFromActiveForApproval);

    // Keep a few legacy special-cases, but key off `activeDecrees`
    if (activeDecrees?.forced_labor) {
        if (popStructure.serf > 0) classApproval.serf = Math.max(0, (classApproval.serf || 50) - 5);
    }

    if (activeDecrees?.tithe) {
        if (popStructure.cleric > 0) classApproval.cleric = Math.max(0, (classApproval.cleric || 50) - 2);
        const titheDue = (popStructure.cleric || 0) * 2 * effectiveTaxModifier;
        if (titheDue > 0) {
            const available = wealth.cleric || 0;
            const paid = Math.min(available, titheDue);
            wealth.cleric = Math.max(0, available - paid);
            taxBreakdown.headTax += paid;
            // 记录什一税支出
            roleExpense.cleric = (roleExpense.cleric || 0) + paid;
        }
    }

    // REFACTORED: Use shared calculateLivingStandards function from needs.js
    // incorporating new Income-Expense Balance Model

    // ====================================================================================================
    // 5. Advanced Cabinet Mechanics (Left/Right Dominance Active Effects)
    // ====================================================================================================

    // --- Left Dominance: Planned Economy (Quota System) ---
    // User sets target population ratios. We adjust actual population towards targets.
    const quotaControls = quotaTargets && typeof quotaTargets === 'object' && Object.prototype.hasOwnProperty.call(quotaTargets, 'targets')
        ? quotaTargets
        : { enabled: true, targets: quotaTargets || {} };

    if (cabinetStatus.dominance?.faction === 'left' && quotaControls?.enabled && quotaControls.targets && Object.keys(quotaControls.targets).length > 0) {
        const { adjustments, approvalPenalties, adminCost } = calculateQuotaEffects(popStructure, quotaControls.targets);

        // [FIX] Population Conservation Logic
        // Calculate total population BEFORE adjustments to ensure conservation
        const previousTotalPop = Object.values(popStructure).reduce((a, b) => a + b, 0);
        let newTotalPop = 0;
        let maxPopStratum = null;
        let maxPopValue = -1;

        // Apply population adjustments
        Object.entries(adjustments).forEach(([stratum, change]) => {
            if (popStructure[stratum] !== undefined) {
                // Apply change
                popStructure[stratum] = Math.max(0, Math.round(popStructure[stratum] + change));
            }
        });

        // Recalculate total after adjustments
        Object.keys(popStructure).forEach(s => {
            const val = popStructure[s];
            newTotalPop += val;
            if (val > maxPopValue) {
                maxPopValue = val;
                maxPopStratum = s;
            }
        });

        // Correction for rounding errors (Conservation of Mass)
        const diff = previousTotalPop - newTotalPop;
        if (diff !== 0 && maxPopStratum) {
            popStructure[maxPopStratum] += diff;
            // Ensure we didn't drop below zero (unlikely unless diff is huge negative)
            if (popStructure[maxPopStratum] < 0) {
                popStructure[maxPopStratum] = 0;
            }
        }

        // Apply approval penalties
        Object.entries(approvalPenalties).forEach(([stratum, penalty]) => {
            if (classApproval[stratum]) {
                // calculateQuotaEffects returns 'penalty' as a value like 5 for -5 approval.
                // Apply 5% of the calculated penalty per day as "dissatisfaction pressure".
                classApproval[stratum] -= penalty * 0.05;
            }
        });
    }

    // --- Right Dominance: Free Market (Owner Expansion) ---
    // Owners automatically build new buildings using their wealth.
    let newBuildingsCount = { ...buildings };
    // [DEBUG] 临时调试信息 - 追踪自由市场机制问题
    const _freeMarketDebug = {
