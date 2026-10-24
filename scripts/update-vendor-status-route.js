const fs = require('fs');

function norm(str) { return str.replace(/\r\n/g, '\n'); }

const file = 'src/app/api/vendor/orders/status/route.ts';
let s = fs.readFileSync(file, 'utf8');
const isCRLF = s.includes('\r\n');
let nS = norm(s);

const target = `    // Update order status
    const [updatedOrder] = await db
      .update(orders)
      .set({
        status: newStatus,
        updatedAt: now,
      })
      .where(eq(orders.id, orderId))
      .returning();`;

const repl = `    // Update order status and pre-order state
    const updateSet: Record<string, any> = {
      status: newStatus,
      updatedAt: now,
    };
    if (body.isFoodReady !== undefined) {
      updateSet.isFoodReady = Boolean(body.isFoodReady);
      if (body.isFoodReady) updateSet.foodReadyAt = now;
    }
    if (body.preorderReadyDate !== undefined) {
      updateSet.preorderReadyDate = String(body.preorderReadyDate).trim() || null;
    }
    if (body.preorderReadyTime !== undefined) {
      updateSet.preorderReadyTime = String(body.preorderReadyTime).trim() || null;
    }

    const [updatedOrder] = await db
      .update(orders)
      .set(updateSet)
      .where(eq(orders.id, orderId))
      .returning();`;

if (!nS.includes(norm(target))) {
  console.error('Target not found in ' + file);
  process.exit(1);
}

nS = nS.replace(norm(target), norm(repl));
if (isCRLF) nS = nS.replace(/\n/g, '\r\n');
fs.writeFileSync(file, nS, 'utf8');
console.log('Successfully updated vendor/orders/status/route.ts');
