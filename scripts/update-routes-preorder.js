const fs = require('fs');

function norm(str) {
  return str.replace(/\r\n/g, '\n');
}

function replaceInFile(file, target, repl) {
  let s = fs.readFileSync(file, 'utf8');
  const isCRLF = s.includes('\r\n');
  let nS = norm(s);
  let nTarget = norm(target);
  let nRepl = norm(repl);

  if (!nS.includes(nTarget)) {
    throw new Error('Target not found in ' + file + ':\n' + nTarget.slice(0, 100));
  }

  nS = nS.replace(nTarget, nRepl);
  if (isCRLF) {
    nS = nS.replace(/\n/g, '\r\n');
  }
  fs.writeFileSync(file, nS, 'utf8');
  console.log('Updated ' + file);
}

function updateOrdersCreate() {
  const file = 'src/app/api/orders/create/route.ts';
  const target1 = `    const pin = String(rawOrder.pin || Math.floor(1000 + Math.random() * 9000)).trim();
    const status = String(rawOrder.status || "PAID").toUpperCase();`;
  const repl1 = `    const pin = String(rawOrder.pin || Math.floor(1000 + Math.random() * 9000)).trim();
    const status = String(rawOrder.status || "PAID").toUpperCase();

    const isPreorder = Boolean(rawOrder.isPreorder || (items.some((it: any) => it.preorderEnabled)));
    const preorderItem = items.find((it: any) => it.preorderEnabled && (it.preorderDate || it.preorderTime));
    const preorderReadyDate = rawOrder.preorderReadyDate ? String(rawOrder.preorderReadyDate) : (preorderItem?.preorderDate || null);
    const preorderReadyTime = rawOrder.preorderReadyTime ? String(rawOrder.preorderReadyTime) : (preorderItem?.preorderTime || null);
    const isFoodReady = Boolean(rawOrder.isFoodReady || false);`;

  replaceInFile(file, target1, repl1);

  const target2 = `        pin,
        routeDistanceMeters: Math.round(distanceMeters),`;
  const repl2 = `        pin,
        isPreorder,
        preorderReadyDate,
        preorderReadyTime,
        isFoodReady,
        foodReadyAt: isFoodReady ? now : null,
        routeDistanceMeters: Math.round(distanceMeters),`;

  replaceInFile(file, target2, repl2);

  const target3 = `          total,
          routeDistanceMeters: Math.round(distanceMeters),`;
  const repl3 = `          total,
          isPreorder,
          preorderReadyDate,
          preorderReadyTime,
          isFoodReady,
          routeDistanceMeters: Math.round(distanceMeters),`;

  replaceInFile(file, target3, repl3);
}

function updatePaymentsVerify() {
  const file = 'src/app/api/payments/verify/route.ts';
  const target1 = `        // 5. Resolve userId`;
  const repl1 = `        const isPreorder = Boolean(rawOrder.isPreorder || (items.some((it: any) => it.preorderEnabled)));
        const preorderItem = items.find((it: any) => it.preorderEnabled && (it.preorderDate || it.preorderTime));
        const preorderReadyDate = rawOrder.preorderReadyDate ? String(rawOrder.preorderReadyDate) : (preorderItem?.preorderDate || null);
        const preorderReadyTime = rawOrder.preorderReadyTime ? String(rawOrder.preorderReadyTime) : (preorderItem?.preorderTime || null);
        const isFoodReady = Boolean(rawOrder.isFoodReady || false);

        // 5. Resolve userId`;

  replaceInFile(file, target1, repl1);

  const target2 = `            pin,
            routeDistanceMeters: Math.round(distanceMeters),`;
  const repl2 = `            pin,
            isPreorder,
            preorderReadyDate,
            preorderReadyTime,
            isFoodReady,
            foodReadyAt: isFoodReady ? now : null,
            routeDistanceMeters: Math.round(distanceMeters),`;

  replaceInFile(file, target2, repl2);
}

function updateTrackRoute() {
  const file = 'src/app/api/orders/[id]/track/route.ts';
  const target1 = `        riderLat: null,
        riderLng: null,
      }, { status: 200 });`;
  const repl1 = `        riderLat: null,
        riderLng: null,
        isPreorder: order.isPreorder ?? false,
        preorderReadyDate: order.preorderReadyDate ?? null,
        preorderReadyTime: order.preorderReadyTime ?? null,
        isFoodReady: order.isFoodReady ?? false,
        foodReadyAt: order.foodReadyAt ? order.foodReadyAt.toISOString() : null,
      }, { status: 200 });`;

  replaceInFile(file, target1, repl1);

  const target2 = `      riderLng: riderRow && riderRow.currentLng ? Number(riderRow.currentLng) : null,
      lastSeenAt: riderRow?.lastSeenAt || null,
    });`;
  const repl2 = `      riderLng: riderRow && riderRow.currentLng ? Number(riderRow.currentLng) : null,
      lastSeenAt: riderRow?.lastSeenAt || null,
      isPreorder: order.isPreorder ?? false,
      preorderReadyDate: order.preorderReadyDate ?? null,
      preorderReadyTime: order.preorderReadyTime ?? null,
      isFoodReady: order.isFoodReady ?? false,
      foodReadyAt: order.foodReadyAt ? order.foodReadyAt.toISOString() : null,
    });`;

  replaceInFile(file, target2, repl2);
}

function updateVendorOrdersRoute() {
  const file = 'src/app/api/vendor/orders/route.ts';
  const target = `      status: o.status,
      pin: o.pin,`;
  const repl = `      status: o.status,
      isPreorder: o.isPreorder ?? false,
      preorderReadyDate: o.preorderReadyDate ?? null,
      preorderReadyTime: o.preorderReadyTime ?? null,
      isFoodReady: o.isFoodReady ?? false,
      foodReadyAt: o.foodReadyAt ? o.foodReadyAt.toISOString() : null,
      pin: o.pin,`;

  replaceInFile(file, target, repl);
}

function updateRiderOffersRoute() {
  const file = 'src/app/api/rider/deliveries/offers/route.ts';
  const target = `        itemCount,
        status: order.status,`;
  const repl = `        itemCount,
        status: order.status,
        isPreorder: order.isPreorder ?? false,
        preorderReadyDate: order.preorderReadyDate ?? null,
        preorderReadyTime: order.preorderReadyTime ?? null,
        isFoodReady: order.isFoodReady ?? false,
        foodReadyAt: order.foodReadyAt ? order.foodReadyAt.toISOString() : null,`;

  replaceInFile(file, target, repl);
}

try {
  updateOrdersCreate();
  updatePaymentsVerify();
  updateTrackRoute();
  updateVendorOrdersRoute();
  updateRiderOffersRoute();
  console.log('All backend route updates completed successfully!');
} catch (err) {
  console.error(err);
  process.exit(1);
}
