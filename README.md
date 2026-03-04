# Instutution-Grade Ledger & Risk Engine

## Overview

This project implements a double-entry ledger system with strict ACID guarantees, idempotent transaction handling, row-level concurrency control, and risk limit enforcement.The goal of this system is to simulate how internal financial infrastructure behaves in banking, payments, and capital markets systems.The system prioritizes correctness, consistency, and auditability over feature breadth.

## Tech Stack

    Node.js
    Express.js
    PostgreSQL
    ACID Transactions
    Serializable Isolation
    Double-entry Accounting

## Core Financial Invariants

    This system enforces the following non-negotiable financial guarantees:

    1. **Ledger is append-only (immutable)**
    Ledger entries cannot be updated or deleted. All corrections must occur through reversal entries.

    2. **No direct balance mutation**
    Account balances are never stored or mutated. They are always derived from ledger entries.

    3. **Double-entry accounting enforced**
    Every successful transaction must create:
    - One DEBIT entry
    - One CREDIT entry
    The total system-wide balance must always equal zero.

    4. **Atomic transaction execution (ACID)**
    All money movements execute inside a single SQL transaction block.
    If any step fails, the entire operation rolls back.

    5. **Idempotent transaction processing**
    Duplicate client requests with the same idempotency key cannot create duplicate ledger entries.

    6. **Concurrency safety via row-level locking**
    Accounts involved in transfers are locked using `SELECT ... FOR UPDATE` to prevent race conditions.

    7. **Deterministic lock ordering**
    Account locks are acquired in a consistent sorted order to eliminate deadlocks.

    8. **Serializable isolation for aggregate safety**
    Transactions execute under `SERIALIZABLE` isolation to prevent write-skew anomalies in aggregate risk checks.

    9. **Risk limits enforced inside transaction boundary**
    Per-transaction and daily limits are validated before ledger mutation, inside the same SQL transaction.

    10. **Fail-fast configuration and graceful shutdown**
        The application validates required environment variables at startup and supports controlled shutdown.

## Architecture

The system follows a strict layered architecture to ensure separation of concerns and maintainability:

Route → Controller → Service → Repository → Database

    ### Layer Responsibilities

    **Controller Layer**
    - Validates input
    - Extracts request data
    - Delegates to service layer
    - Does not contain business logic or SQL

    **Service Layer**
    - Implements business rules
    - Orchestrates transaction flow
    - Enforces financial invariants
    - Handles idempotency coordination
    - Throws structured operational errors

    **Repository Layer**
    - Executes database queries
    - Contains no business logic
    - Uses parameterized SQL only
    - Accepts a transaction-bound client when required

    **Database Layer**
    - Enforces integrity through:
    - Foreign key constraints
    - CHECK constraints
    - UNIQUE constraints (idempotency)
    - Triggers (ledger immutability)
    - Transaction isolation levels

## Transaction Lifecycle

Every transfer request follows the exact sequence below:

    1. **BEGIN SQL Transaction**
    2. **Set Isolation Level to SERIALIZABLE**
    3. **Lock involved accounts using `SELECT ... FOR UPDATE`**
    - Locks are acquired in deterministic sorted order to prevent deadlocks.
    4. **Validate available balance**
    - Balance is derived dynamically from ledger entries.
    5. **Validate risk limits**
    - Per-transaction limit check
    - Daily aggregate exposure check
    6. **Create transaction record**
    - Uses `ON CONFLICT DO NOTHING` for idempotency safety
    7. **Insert DEBIT ledger entry**
    8. **Insert CREDIT ledger entry**
    9. **Mark transaction as COMPLETED**
    10. **COMMIT**

    If any step fails:
    - The transaction is rolled back.
    - No partial ledger entries persist.
    - No transaction row persists.

## Concurrency Model & Isolation Strategy

This system is designed to operate safely under concurrent request load.

    ### Row-Level Locking

    Accounts involved in a transfer are locked using:

    `SELECT ... FOR UPDATE`

    This ensures:
    - Concurrent transfers cannot modify the same account simultaneously.
    - Balance validation always reflects the most recent committed state.
    - Double-spend conditions are prevented.

    ### Deterministic Lock Ordering

    To prevent deadlocks during cross-account transfers:

    - Account IDs are sorted lexicographically.
    - Locks are acquired in a consistent order.

    This eliminates circular wait conditions.

    ### Isolation Level

    All transactions execute under:

    `SERIALIZABLE`

    Rationale:
    - Prevents write-skew anomalies in aggregate risk checks.
    - Ensures daily exposure limits cannot be bypassed under concurrency.
    - Provides full transaction-level consistency.

    ### Automatic Retry on Serialization Failure

    If PostgreSQL raises a serialization error (`40001`):

    - The transaction is retried automatically (limited retry count).
    - Idempotency guarantees ensure safe retry behavior.
    - No duplicate ledger entries can occur during retry.

## Idempotency & Retry Safety

The system enforces idempotent transaction processing at the database level.

    ### Idempotency Key

    Each transfer request requires a unique `idempotencyKey`.

    The `transactions` table enforces:

    - A UNIQUE constraint on `idempotency_key`
    - Conflict-safe insertion using:

    `INSERT ... ON CONFLICT DO NOTHING`

    ### Side-Effect Protection

    When a duplicate request is received:

    - The transaction record is not recreated.
    - Ledger entries are not reinserted.
    - The previously created transaction is returned.

    This ensures that:
    - Network retries cannot create duplicate debits.
    - Concurrent duplicate requests cannot double-post ledger entries.

    ### Retry Under SERIALIZABLE Isolation

    Under SERIALIZABLE isolation, PostgreSQL may abort a transaction with:

    `40001 – serialization_failure`

    The system automatically retries the entire transaction block.

    Safety is guaranteed because:

    - Idempotency prevents duplicate transaction creation.
    - Ledger entries are inserted only if the transaction is newly created.
    - Retry does not introduce duplicate financial side effects.

## Risk Engine

    The system includes a synchronous risk validation layer that enforces policy constraints before ledger mutation.

    ### Supported Risk Controls

    1. **Per-Transaction Limit**
    - Maximum allowed transfer amount per request.
    - Enforced before transaction creation.

    2. **Daily Aggregate Limit**
    - Total debit amount per account per day cannot exceed a configured threshold.
    - Calculated dynamically from ledger entries.

    ### Execution Model

    Risk validation occurs:

    - After account locking
    - After balance validation
    - Before transaction creation
    - Inside the same SQL transaction boundary

    This guarantees:

    - Risk checks operate on a consistent snapshot.
    - No race condition can bypass limit enforcement under SERIALIZABLE isolation.
    - No partial ledger state occurs if risk validation fails.

    ### Risk Configuration

    Risk limits are stored in:

    `account_limits` table

    This allows:

    - Policy changes without code modification.
    - Independent risk configuration per account.

## Failure Handling & Defensive Engineering

    The system distinguishes between operational errors and programmer errors.

    ### Structured Error Handling

    Business rule violations throw structured operational errors using a custom `AppError` class.

    Examples:
    - Insufficient funds
    - Risk limit exceeded
    - Invalid input
    - Account not found

    Operational errors:
    - Return controlled HTTP responses.
    - Do not leak stack traces.

    Unexpected errors:
    - Return generic 500 responses.
    - Prevent sensitive information disclosure.

    ### Atomic Rollback Guarantee

    All transfer logic runs inside a single SQL transaction block.

    If any step fails:
    - The transaction is rolled back.
    - No ledger entries persist.
    - No transaction row persists.

    Failure scenarios tested:
    - Artificial failure after debit insertion.
    - Serialization failure under concurrency.
    - Duplicate idempotency race.

    ### Environment Safety

    At application startup:
    - Required environment variables are validated.
    - The application fails fast if configuration is incomplete.

    ### Graceful Shutdown

    The system handles termination signals by:
    - Stopping new HTTP requests.
    - Closing database connection pool.
    - Allowing active operations to complete safely.

    This prevents:
    - Partial request handling.
    - Database connection leaks.
    - Inconsistent shutdown behavior.

## Testing Strategy

    The system was manually tested under multiple failure and concurrency scenarios to validate financial integrity.

    ### Concurrency Simulation

    - Simultaneous transfers between the same accounts.
    - Reverse-direction transfers (A → B and B → A).
    - Validation of row-level locking behavior.

    ### Deadlock Simulation

    - Cross-account transfers tested for circular wait.
    - Deterministic lock ordering confirmed to eliminate deadlocks.

    ### Idempotency Race Test

    - Parallel requests with identical idempotency keys.
    - Verified that only one transaction record and two ledger entries are created.

    ### Failure Injection

    - Artificial error injected after debit insertion.
    - Confirmed full transaction rollback.
    - Verified no partial ledger entries persisted.

    ### Aggregate Risk Stress Test

    - Concurrent transfers attempting to exceed daily limits.
    - Verified SERIALIZABLE isolation prevents write-skew anomalies.

## Security & Integrity Guarantees

    The system enforces strong financial integrity through database-level constraints:

    ### Ledger Immutability

    - UPDATE and DELETE operations on `ledger_entries` are blocked via database trigger.
    - Ledger operates as append-only.
    - Historical financial data cannot be modified.

    ### Referential Integrity

    - Foreign key constraints ensure ledger entries reference valid accounts and transactions.
    - Invalid financial relationships cannot be inserted.

    ### Data Consistency

    - Double-entry model guarantees total debits equal total credits.
    - Balance is derived from immutable ledger history.

    ### Transaction Integrity

    - All state changes occur within SQL transactions.
    - ACID guarantees enforced at database level.

    This ensures the system behaves predictably even under concurrent load, retries, and failure scenarios.
