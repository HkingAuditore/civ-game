# AI Economy System Architecture

## System Overview

```mermaid
graph TB
    subgraph "Entry Point"
        SIM[simulation.js]
    end
    
    subgraph "Service Layer"
        SERVICE[AIEconomyService]
    end
    
    subgraph "Calculator Layer"
        GROWTH[GrowthCalculator]
        RESOURCE[ResourceManager]
    end
    
    subgraph "Model Layer"
        STATE[AIEconomyState]
        CONFIG[aiEconomyConfig]
    end
    
    subgraph "External Dependencies"
        LOGISTIC[logisticGrowth.js]
        RESOURCES_CONFIG[RESOURCES config]
    end
    
    subgraph "Utilities"
        MIGRATION[economyMigration]
        DEBUG[economyDebugger]
    end
    
    SIM -->|update nation| SERVICE
    SERVICE -->|convert| STATE
    SERVICE -->|calculate growth| GROWTH
    SERVICE -->|update resources| RESOURCE
    SERVICE -->|convert back| STATE
    
    GROWTH -->|use| LOGISTIC
    GROWTH -->|get params| CONFIG
    
    RESOURCE -->|get resources| RESOURCES_CONFIG
    RESOURCE -->|get params| CONFIG
    
    STATE -->|validate| STATE
    STATE -->|to/from legacy| STATE
    
    MIGRATION -->|migrate| STATE
    DEBUG -->|monitor| SERVICE
    
    style SERVICE fill:#4CAF50
    style STATE fill:#2196F3
    style CONFIG fill:#FF9800
    style GROWTH fill:#9C27B0
    style RESOURCE fill:#9C27B0
```

## Data Flow

```mermaid
sequenceDiagram
    participant Sim as simulation.js
    participant Svc as AIEconomyService
    participant State as AIEconomyState
    participant Growth as GrowthCalculator
    participant Res as ResourceManager
    participant Config as aiEconomyConfig
    
    Sim->>Svc: update(nation, tick, ...)
    Svc->>State: fromLegacyFormat(nation)
    State->>State: validate()
    
    alt Should Update Growth
        Svc->>Growth: calculatePopulationGrowth(...)
        Growth->>Config: getConfig('growth.warPenalty')
        Growth-->>Svc: {newPopulation, growth}
        
        Svc->>Growth: calculateWealthGrowth(...)
        Growth->>Config: getPerCapitaWealthCap(epoch)
        Growth-->>Svc: {newWealth, growth}
        
        Svc->>State: update population & wealth
    end
    
    Svc->>Res: updateInventory(...)
    Res->>Config: getConfig('resources.*')
    Res-->>Svc: updatedInventory
    
    Svc->>Res: updateBudget(...)
    Res-->>Svc: newBudget
    
    Svc->>State: toLegacyFormat()
    Svc-->>Sim: updatedNation
```

## Module Responsibilities

```mermaid
graph LR
    subgraph "Models"
        M1[AIEconomyState<br/>Data Structure]
    end
    
    subgraph "Config"
        C1[aiEconomyConfig<br/>Parameters]
    end
    
    subgraph "Calculators"
        CA1[GrowthCalculator<br/>Population & Wealth]
        CA2[ResourceManager<br/>Inventory & Budget]
    end
    
    subgraph "Services"
        S1[AIEconomyService<br/>Orchestrator]
    end
    
    subgraph "Utilities"
        U1[economyMigration<br/>Data Migration]
        U2[economyDebugger<br/>Debugging]
    end
    
    M1 -.provides.-> S1
    C1 -.provides.-> CA1
    C1 -.provides.-> CA2
    CA1 -.provides.-> S1
    CA2 -.provides.-> S1
    U1 -.uses.-> M1
    U2 -.monitors.-> S1
    
    style M1 fill:#2196F3
    style C1 fill:#FF9800
    style CA1 fill:#9C27B0
    style CA2 fill:#9C27B0
    style S1 fill:#4CAF50
    style U1 fill:#607D8B
    style U2 fill:#607D8B
```

## Configuration Structure

```mermaid
graph TD
    CONFIG[aiEconomyConfig]
    
    CONFIG --> GROWTH[growth]
    CONFIG --> WEALTH[wealth]
    CONFIG --> EPOCH[epoch]
    CONFIG --> RESOURCES[resources]
    CONFIG --> DIFFICULTY[difficulty]
    CONFIG --> SOFTCAPS[softCaps]
    
    GROWTH --> G1[baseRate: 0.02]
    GROWTH --> G2[warPenalty: 0.3]
    GROWTH --> G3[updateInterval: 10]
    GROWTH --> G4[minimumGrowth: {...}]
    
    WEALTH --> W1[perCapitaCaps: {...}]
    WEALTH --> W2[baseGrowthRate: 0.01]
    WEALTH --> W3[budgetRatio: 0.5]
    
    RESOURCES --> R1[baseInventoryTarget: 500]
    RESOURCES --> R2[baseProductionRate: 5.0]
    RESOURCES --> R3[warConsumptionMultiplier: 1.3]
    
    style CONFIG fill:#FF9800
    style GROWTH fill:#4CAF50
    style WEALTH fill:#2196F3
    style RESOURCES fill:#9C27B0
```

## State Lifecycle

```mermaid
stateDiagram-v2
    [*] --> LegacyFormat: Old Nation Data
    
    LegacyFormat --> NewState: fromLegacyFormat()
    NewState --> Validated: validate()
    
    Validated --> GrowthUpdate: shouldUpdateGrowth?
    GrowthUpdate --> ResourceUpdate: always
    ResourceUpdate --> BudgetUpdate: always
    
    BudgetUpdate --> LegacyFormat: toLegacyFormat()
    LegacyFormat --> [*]: Updated Nation
    
    note right of NewState
        AIEconomyState
        - population
        - wealth
        - inventory
        - budget
        - timestamps
    end note
    
    note right of GrowthUpdate
        Every 10 ticks:
        - Calculate pop growth
        - Calculate wealth growth
        - Update timestamps
    end note
    
    note right of ResourceUpdate
        Every tick:
        - Update inventory
        - Production/consumption
        - Long-cycle trends
    end note
```

## Integration Points

```mermaid
graph TB
    subgraph "Old System (To Be Replaced)"
        OLD1[updateAINationInventory]
        OLD2[processAIIndependentGrowth]
        OLD3[updateAIDevelopment]
    end
    
    subgraph "New System"
        NEW[AIEconomyService.update]
    end
    
    subgraph "Simulation Loop"
        SIM[simulation.js]
    end
    
    SIM -.old calls.-> OLD1
    SIM -.old calls.-> OLD2
    SIM -.old calls.-> OLD3
    
    SIM ==new call==> NEW
    
    NEW -.replaces.-> OLD1
    NEW -.replaces.-> OLD2
    NEW -.replaces.-> OLD3
    
    style OLD1 fill:#f44336,color:#fff
    style OLD2 fill:#f44336,color:#fff
    style OLD3 fill:#f44336,color:#fff
    style NEW fill:#4CAF50,color:#fff
    style SIM fill:#2196F3,color:#fff
```

## Migration Strategy

```mermaid
graph LR
    subgraph "Phase 1: Preparation"
        P1[Create New Modules]
        P2[Add Tests]
        P3[Add Documentation]
    end
    
    subgraph "Phase 2: Integration"
        I1[Add Feature Flag]
        I2[Parallel Run]
        I3[Compare Results]
    end
    
    subgraph "Phase 3: Rollout"
        R1[Enable for New Games]
        R2[Enable for All]
        R3[Remove Old Code]
    end
    
    P1 --> P2 --> P3
    P3 --> I1 --> I2 --> I3
    I3 --> R1 --> R2 --> R3
    
    style P1 fill:#4CAF50
    style P2 fill:#4CAF50
    style P3 fill:#4CAF50
    style I1 fill:#FF9800
    style I2 fill:#FF9800
    style I3 fill:#FF9800
    style R1 fill:#2196F3
    style R2 fill:#2196F3
    style R3 fill:#2196F3
```

---

**Note**: These diagrams use Mermaid syntax and can be rendered in:
- GitHub (native support)
- VS Code (with Mermaid extension)
- Online editors (mermaid.live)
- Documentation sites (GitBook, Docusaurus, etc.)
