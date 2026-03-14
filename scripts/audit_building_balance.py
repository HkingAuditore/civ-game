#!/usr/bin/env python3
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BUILDINGS_PATH = ROOT / "src/config/buildings.js"
UPGRADES_PATH = ROOT / "src/config/buildingUpgrades.js"
NON_RESOURCE_OUTPUTS = {"maxPop", "militaryCapacity"}

CHAINS = {
    "food": ["farm", "large_estate", "mechanized_farm"],
    "wood": ["lumber_camp", "hardwood_camp", "logging_company"],
    "stone": ["quarry", "stone_workshop"],
    "cloth": ["loom_house", "wool_workshop", "cotton_weaving_house", "textile_mill", "electric_textile_mill"],
    "fine_clothes": ["tailor_workshop", "garment_factory", "synthetic_textile_mill"],
    "tools": ["stone_tool_workshop", "bronze_foundry", "iron_tool_workshop", "metallurgy_workshop", "factory"],
    "brick": ["brickworks", "building_materials_plant", "prefab_factory"],
    "iron": ["mine", "shaft_mine", "industrial_mine"],
    "ale": ["brewery", "monastery_cellar", "distillery"],
    "science": ["library", "navigator_school", "university", "research_institute"],
    "copper": ["copper_mine", "advanced_copper_mine", "automated_mine"],
}

MODIFIED_BUILDINGS = {
    building_id
    for building_ids in CHAINS.values()
    for building_id in building_ids
}


def parse_obj_literal(body):
    result = {}
    for part in body.split(","):
        if ":" not in part:
            continue
        key, value = part.split(":", 1)
        key = key.strip().strip("'\"")
        match = re.search(r"-?\d+(?:\.\d+)?", value)
        if match:
            result[key] = float(match.group(0))
    return result


def parse_buildings():
    text = BUILDINGS_PATH.read_text(encoding="utf-8")
    entries = {}
    lines = text.splitlines()
    inside = False
    depth = 0
    buffer = []

    for line in lines:
        if not inside and line.strip().startswith("{"):
            inside = True
            depth = line.count("{") - line.count("}")
            buffer = [line]
            continue

        if not inside:
            continue

        buffer.append(line)
        depth += line.count("{") - line.count("}")
        if depth != 0:
            continue

        block = "\n".join(buffer)
        inside = False
        id_match = re.search(r"id:\s*'([^']+)'", block)
        epoch_match = re.search(r"epoch:\s*(\d+)", block)
        output_match = re.search(r"output:\s*\{([^}]*)\}", block, re.S)
        jobs_match = re.search(r"jobs:\s*\{([^}]*)\}", block, re.S)
        if not id_match or not epoch_match:
            continue
        entries[id_match.group(1)] = {
            "epoch": int(epoch_match.group(1)),
            "output": parse_obj_literal(output_match.group(1) if output_match else ""),
            "jobs": parse_obj_literal(jobs_match.group(1) if jobs_match else ""),
        }

    return entries


def parse_upgrades():
    text = UPGRADES_PATH.read_text(encoding="utf-8")
    upgrades = {}
    lines = text.splitlines()
    i = 0

    while i < len(lines):
        match = re.match(r"\s*([a-zA-Z0-9_]+):\s*\[\s*$", lines[i])
        if not match:
            i += 1
            continue

        building_id = match.group(1)
        i += 1
        levels = []

        while i < len(lines) and not re.match(r"\s*\],?\s*$", lines[i]):
            if lines[i].strip().startswith("{"):
                depth = lines[i].count("{") - lines[i].count("}")
                buffer = [lines[i]]
                i += 1
                while i < len(lines) and depth > 0:
                    buffer.append(lines[i])
                    depth += lines[i].count("{") - lines[i].count("}")
                    i += 1
                block = "\n".join(buffer)
                output_match = re.search(r"output:\s*\{([^}]*)\}", block, re.S)
                jobs_match = re.search(r"jobs:\s*\{([^}]*)\}", block, re.S)
                levels.append({
                    "output": parse_obj_literal(output_match.group(1) if output_match else ""),
                    "jobs": parse_obj_literal(jobs_match.group(1) if jobs_match else ""),
                })
                continue
            i += 1

        upgrades[building_id] = levels
        i += 1

    return upgrades


def get_primary_amount(output, primary_key):
    if primary_key in output:
        return output[primary_key]
    keys = [key for key, value in output.items() if key not in NON_RESOURCE_OUTPUTS and value > 0]
    return output.get(keys[0], 0.0) if keys else 0.0


def get_total_jobs(jobs):
    return sum(value for value in jobs.values() if isinstance(value, (int, float)))


def check_comment_staleness(warnings):
    lines = UPGRADES_PATH.read_text(encoding="utf-8").splitlines()
    current_resource = None
    expected = {}
    buildings = parse_buildings()

    for resource, building_ids in CHAINS.items():
        for building_id in building_ids:
            expected[building_id] = (resource, buildings[building_id]["output"].get(resource))

    for line in lines:
        match = re.match(r"\s*//\s*([a-zA-Z0-9_]+):\s*base output\s*(.+)", line)
        if not match:
            continue
        building_id = match.group(1)
        if building_id not in expected:
            continue
        resource, amount = expected[building_id]
        if amount is None:
            continue
        rounded = f"{amount:.1f}"
        precise = f"{amount:.2f}".rstrip("0").rstrip(".")
        comment = match.group(2)
        if rounded not in comment and precise not in comment:
            warnings.append(
                f"[comment] {building_id} 注释中的 base output 未反映当前 {resource}={amount:.2f}"
            )


def main():
    buildings = parse_buildings()
    upgrades = parse_upgrades()
    errors = []
    warnings = []
    rows = []

    print("== Building Balance Audit ==")

    for resource, building_ids in CHAINS.items():
        prev_per_job = None
        print(f"\n[{resource}]")
        for building_id in building_ids:
            base = buildings[building_id]
            levels = [{
                "label": "Base",
                "output": base["output"],
                "jobs": base["jobs"],
            }]
            for index, level in enumerate(upgrades.get(building_id, []), start=1):
                levels.append({
                    "label": f"Lv{index}",
                    "output": level["output"],
                    "jobs": level["jobs"],
                })

            if building_id in MODIFIED_BUILDINGS and len(levels) < 3:
                errors.append(f"[upgrade] {building_id} 被列入重平衡名单，但未找到完整升级链")
                continue

            level_per_jobs = []
            for level in levels:
                jobs = get_total_jobs(level["jobs"])
                amount = get_primary_amount(level["output"], resource)
                per_job = amount / max(1, jobs)
                level_per_jobs.append(per_job)
                print(f"{building_id:24} {level['label']:>4} output={amount:7.2f} jobs={jobs:4.1f} perJob={per_job:6.3f}")

            if not (level_per_jobs[0] < level_per_jobs[1] < level_per_jobs[2]):
                errors.append(f"[monotonic] {building_id} 的 Base/Lv1/Lv2 主产出人均未严格递增")

            if prev_per_job is not None and level_per_jobs[0] <= prev_per_job:
                errors.append(f"[cross-era] {building_id} Base 未超过前代终级人均产出 ({level_per_jobs[0]:.3f} <= {prev_per_job:.3f})")

            if get_total_jobs(levels[1]["jobs"]) > get_total_jobs(levels[0]["jobs"]) and level_per_jobs[1] <= level_per_jobs[0]:
                errors.append(f"[job-growth] {building_id} Lv1 加岗但人均主产出未提升")
            if get_total_jobs(levels[2]["jobs"]) > get_total_jobs(levels[1]["jobs"]) and level_per_jobs[2] <= level_per_jobs[1]:
                errors.append(f"[job-growth] {building_id} Lv2 加岗但人均主产出未提升")

            prev_per_job = level_per_jobs[-1]

    check_comment_staleness(warnings)

    if errors:
        print("\nFAILED")
        for error in errors:
            print(error)
        if warnings:
            print("\nWARNINGS")
            for warning in warnings:
                print(warning)
        sys.exit(1)

    if warnings:
        print("\nWARNINGS")
        for warning in warnings:
            print(warning)
    print("\nPASS")


if __name__ == "__main__":
    main()
