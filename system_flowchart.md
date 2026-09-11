# Management System Flowchart

> **Shape Legend** used in all diagrams below:
>
> | Shape | Mermaid Syntax | Meaning |
> |---|---|---|
> | `([...])` | Stadium/Pill | **Start / End** (Terminal) |
> | `[...]` | Rectangle | **Process** / Action |
> | `{...}` | Diamond | **Decision** (Yes/No) |
> | `[/..../]` | Parallelogram | **Input / Output** |
> | `[(...)` | Cylinder | **Database** |
> | `((...))` | Double Circle | **Actor / User** |
> | `:::` | Subgraph | **Swimlane / System** |

---

## 1. System Architecture & High-Level Data Flow

```mermaid
flowchart TD
    START([▶ System Start]) --> LOGIN

    subgraph FE ["🖥️ React Frontend"]
        LOGIN[/User Opens Browser/]
        AUTH_CTX[Auth Context\nCheck Token]
        ROUTE{Route\nProtected?}
        PAGES[Load Page Component]
        SEND[/Send HTTP API Request/]
        RECV[/Receive JSON Response/]
        RENDER[Render UI to User]
    end

    subgraph BE ["⚙️ Laravel Backend API"]
        ROUTE_API[API Router]
        AUTH_MW{Auth Middleware\nValid Token?}
        ROLE_CHK{Role\nAuthorized?}
        CTRL[Controller Logic]
        MODEL[Eloquent Model]
    end

    subgraph DB ["🗄️ MySQL Database"]
        DATABASE[(Comoda DB)]
    end

    LOGIN --> AUTH_CTX
    AUTH_CTX --> ROUTE
    ROUTE -->|Yes – No Token| LOGIN
    ROUTE -->|No – Has Token| PAGES
    PAGES --> SEND
    SEND --> ROUTE_API
    ROUTE_API --> AUTH_MW
    AUTH_MW -->|Invalid| SEND
    AUTH_MW -->|Valid| ROLE_CHK
    ROLE_CHK -->|Unauthorized 403| SEND
    ROLE_CHK -->|Authorized| CTRL
    CTRL --> MODEL
    MODEL -->|Query / Mutate| DATABASE
    DATABASE -->|Results| MODEL
    MODEL --> CTRL
    CTRL -->|JSON| RECV
    RECV --> RENDER
```

---

## 2. User Login & Role-Based Access

```mermaid
flowchart TD
    A([▶ Start]) --> B[/Enter Username & Password/]
    B --> C[Submit Login Form]
    C --> D{Credentials\nValid?}
    D -->|No| E[/Show Error Message/]
    E --> B
    D -->|Yes| F[Issue Sanctum Token]
    F --> G{Check\nUser Role}

    G -->|Admin| H[["🔑 Admin\nDashboard · Users · Reports\nSettings · All Modules"]]
    G -->|Cashier| I[["💰 Cashier\nPOS · Sales\nExpenses · Fund Requests"]]
    G -->|Purchaser| J[["🛒 Purchaser\nInventory · Fund Requests\nStock Batches"]]
    G -->|Kitchen Staff| K[["🍳 Kitchen Staff\nKitchen Screen\nInventory"]]
    G -->|Waiter| L[["🍽️ Waiter\nPOS · Kitchen\nInventory"]]
    G -->|Bar| M[["🍹 Bar\nPOS · Kitchen"]]
    G -->|Pastry| N[["🧁 Pastry\nKitchen · Inventory"]]

    H & I & J & K & L & M & N --> Z([■ End – User Session Active])
```

---

## 3. Purchasing & Fund Reconciliation Workflow

```mermaid
flowchart TD
    START([▶ Purchaser Needs to Restock]) 

    START --> S1[/Purchaser fills out\nFund Request Form\nItem · Supplier · Est. Cost/]
    S1 --> S2[Submit Fund Request]
    S2 --> S3{Cashier\nApproves?}

    S3 -->|Rejected| S3R[/Notify Purchaser:\nRequest Denied/]
    S3R --> START

    S3 -->|Approved| S4[/Cashier Disburses\nFunds to Purchaser/]
    S4 --> S5[Purchaser Buys\nItems from Supplier]
    S5 --> S6[Restock Inventory\nLog StockBatch + StockLog]
    S6 --> S7[/Purchaser Submits\nExpenditure Report\nActual Amount Spent/]
    S7 --> S8[Cashier Reconciles\nCash vs. Receipts]

    S8 --> S9{Discrepancy\nFound?}
    S9 -->|No – Matched| S10[/Mark Fund Request\nas Reconciled/]
    S10 --> S11[Log Final Expense]
    S11 --> DONE([■ End])

    S9 -->|Yes – Overspent| S12[/System Flags\nOverspending Alert/]
    S12 --> S13[/Admin Reviews\nOverspending Report/]
    S13 --> S14{Admin\nDecision}
    S14 -->|Approved| S10
    S14 -->|Rejected| S15[/Request Refund\nor Adjustment/]
    S15 --> S8
```

---

## 4. Point of Sale (POS) & Kitchen Workflow

```mermaid
flowchart TD
    START([▶ New Customer Order])

    START --> P1[/Waiter or Cashier\nSelects Menu Items/]
    P1 --> P2[Create Order Record\nin System]
    P2 --> P3[Deduct Inventory Stock\nlinked to Menu Items]
    P3 --> P4[/Kitchen Screen\nDisplays New Order/]

    P4 --> P5[Kitchen Staff\nAcknowledges Order]
    P5 --> P6[Mark Items:\n🟡 Preparing]
    P6 --> P7{All Items\nReady?}
    P7 -->|No| P6
    P7 -->|Yes| P8[Mark Order:\n🟢 Ready]

    P8 --> P9[/Notify Waiter:\nOrder is Ready/]
    P9 --> P10[Serve Food\nto Customer]
    P10 --> P11[/Cashier Processes\nPayment/]
    P11 --> P12{Payment\nMethod?}
    P12 -->|Cash| P13[Compute Change]
    P12 -->|Other| P14[Log Transaction]
    P13 --> P14

    P14 --> P15[Generate Sale Record\nCalculate Net Profit]
    P15 --> P16[/Print or Show\nReceipt/]
    P16 --> DONE([■ End])
```

---

## 5. Inventory Management Workflow

```mermaid
flowchart TD
    START([▶ Access Inventory Module])

    START --> I1{User Role?}
    I1 -->|Admin / Kitchen / Waiter / Pastry| I2[View Inventory List]
    I1 -->|Purchaser| I3[View + Manage Inventory]

    I2 --> I_END([■ Read-Only View])

    I3 --> I4{Action\nSelected}
    I4 -->|Add New Item| I5[/Enter Item Details\nName · Unit · Category/]
    I5 --> I6[Save New\nInventory Item]
    I6 --> I7[/Show Updated\nInventory List/]

    I4 -->|Restock Item| I8{Fund Request\nApproved?}
    I8 -->|No| I9[/Redirect to\nFund Request Workflow/]
    I9 --> I_END2([■ End – Await Approval])
    I8 -->|Yes| I10[/Enter Stock Batch Details\nQty · Cost · Supplier/]
    I10 --> I11[Create StockBatch Record]
    I11 --> I12[Update Item\nCurrent Stock Level]
    I12 --> I13[Log StockLog Entry]
    I13 --> I7

    I4 -->|Delete Item| I14{Confirm\nDelete?}
    I14 -->|No| I3
    I14 -->|Yes| I15[Remove Item\nfrom Database]
    I15 --> I7

    I7 --> I_END3([■ End])
```

---

## 6. Cashier Expenses Workflow

```mermaid
flowchart TD
    START([▶ Cashier Opens Expenses])
    START --> E1[/Open Expense Ledger/]
    E1 --> E2{Choose Action}

    E2 -->|Record| E3[/Enter Date, Category, Description, Amount/]
    E3 --> E4[Validate Inputs]
    E4 --> E5{Valid?}
    E5 -->|No| E3
    E5 -->|Yes| E6[Save Expense]
    E6 --> E7[(Store in Database)]
    E7 --> E8[/Show Updated Totals/]

    E2 -->|View| E9[Filter by Date or Category]
    E9 --> E8

    E2 -->|Delete| E10{Confirm Delete?}
    E10 -->|Yes| E11[Remove Record]
    E11 --> E7
    E10 -->|No| E8

    E8 --> DONE([■ End])
```

---

## 7. Sales & Expense Reporting Workflow

```mermaid
flowchart TD
    START([▶ Access Reports Module])
    START --> R1{Report Type?}

    R1 -->|Sales Report| R2[Fetch Sale Records\nfrom Database]
    R2 --> R3[/Display Sales Table\nDate · Revenue · Items Sold/]
    R3 --> R4[Calculate Net Profit\nRevenue - Expenses - Fund Costs]
    R4 --> R5[/Show Net Profit\nSummary/]

    R1 -->|Expense Report| R6[Fetch Expense Records]
    R6 --> R7[/Display Expenses Table\nCategory · Amount · Date/]
    R7 --> R8{Filter\nApplied?}
    R8 -->|Yes| R9[Re-query with Filters\nDate Range · Category]
    R9 --> R7
    R8 -->|No| R10[/Show Expense Totals/]

    R1 -->|Fund Request Report| R11[Fetch FundRequests\nAll Statuses]
    R11 --> R12[/Display:\nPending · Approved · Reconciled/]
    R12 --> R13{Admin\nRole?}
    R13 -->|Yes| R14[Can Approve\nOverspending]
    R13 -->|No| R15[Read-Only View]

    R5 & R10 & R14 & R15 --> DONE([■ End])
```
