
# Extraction Plan: Notifications

## Why Notifications First?

Notifications is the first extraction candidate because Orders now publishes an `order.placed` event instead of directly calling the Notifications service. Notifications subscribes to that event and sends the order confirmation.

This gives Notifications a clearer boundary than a module that is still directly called by other modules. Extracting Notifications first would let us test whether the event-based boundary works across a process or network boundary before extracting more tightly connected modules.

## Data Ownership

| Table | Owner | Purpose |
|---|---|---|
| `outbox` | Notifications | Stores notification messages (`id`, `to`, `subject`) |
| `orders` | Orders | Stores order details |
| `stock` | Inventory | Stores SKU and on-hand quantity |
| `charges` | Payments | Stores charge records |



## Table Readers and Cross-Module Dependencies

| Table | Owner | Readers / Access |
|---|---|---|
| `outbox` | Notifications | Notifications service writes messages; `sent()` reads messages. |
| `orders` | Orders | Orders service writes and retrieves orders through `get()`. |
| `stock` | Inventory | Inventory service reads and updates stock during reservation. |
| `charges` | Payments | Payments service writes charge records. |

The tables are stored through the shared in-memory database in `src/platform/db.ts`. Each module has its own repository file, but the current database implementation does not enforce ownership at runtime.

## Calls That Become Network Calls

If Notifications is extracted into a separate service, the `order.placed` event delivery will cross a process boundary instead of being an in-process function call.

- **Timeout:** Notifications may be slow or unreachable.
- **Failure handling:** Orders must not depend on an immediate Notifications response to decide whether an order was placed successfully.
- **Retry and delivery:** Notification delivery should be retried or recorded for later processing rather than silently lost.
- **Data ownership:** Notifications should own its `outbox`; other services should not read or write that table directly.



## Extraction Stages

### 1. Make the Boundary Real
- Keep Orders publishing `order.placed` through the platform event bus.
- Keep Notifications subscribed to the event instead of being called directly by Orders.
- Verify with `npm run boundaries` and `npm test`.
- Ensure no other module imports Notifications internals.

### 2. Move the Data
- Make Notifications the sole owner of the `outbox` table.
- Identify any code that reads or writes `outbox` from outside Notifications.
- Move the data to storage owned by the Notifications service and verify message IDs and message contents remain correct.

### 3. Put a Seam in Front
- Introduce a Notifications client or adapter behind the existing event subscription.
- Define timeout, retry, and failure behavior at this seam.
- Test successful delivery, timeout, and unavailable-service scenarios without changing Orders' order-placement contract.

### 4. Deploy Separately
- Deploy Notifications independently and configure the event delivery mechanism.
- Verify event delivery, message persistence, retries, and monitoring in the deployed environment.
- Keep the previous in-process implementation available for a controlled rollback.

### 5. Stop
- Stop once Notifications can be deployed independently, owns its data, and receives events reliably.
- Do not extract another module until operational evidence shows a need.
- If the service boundary adds more operational cost than value, keep Notifications as a module in the monolith.

## If Notifications Is Down for 10 Minutes

Order placement must not fail solely because Notifications is unavailable. The order and payment result should remain determined by the Orders and Payments workflows.

For reliable confirmation, use durable event storage or an outbox-style mechanism so `order.placed` can be retried after Notifications recovers. During the outage, confirmations may be delayed; after recovery, pending events should be processed without silently losing them. Delivery should be idempotent to avoid duplicate confirmations during retries.

The current in-memory event bus does not provide durable delivery across process restarts. That capability must be added before relying on this behavior in a separately deployed system.
