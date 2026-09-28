"use client";

import type { FoodItem } from "@/lib/types/vendor";

function formatPrice(amount: number): string {
  return `₦${amount.toLocaleString()}`;
}

export function FoodCard({
  food,
  onToggleAvailability,
  onEdit,
}: {
  food: FoodItem;
  onToggleAvailability: (id: string) => void;
  onEdit: (id: string) => void;
}) {
  const isAvailable = food.status === "available";
  const isPreorder = food.status === "preorder";
  const isOutOfStock = food.status === "out_of_stock";

  const requiredExtras = food.extras.filter((e) => e.type === "required");
  const optionalExtras = food.extras.filter((e) => e.type === "optional");

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      {/* Food Image */}
      <div className="relative h-40 bg-gradient-to-br from-green-light to-mint flex items-center justify-center">
        {food.imageUrl ? (
          <img
            src={food.imageUrl}
            alt={food.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-5xl">🍽️</span>
        )}
        {isPreorder && (
          <span className="absolute top-3 left-3 bg-yellow text-ink text-[11px] font-bold px-2.5 py-1 rounded-full">
            🟡 Pre-order
          </span>
        )}
        {isOutOfStock && (
          <span className="absolute top-3 left-3 bg-red/10 text-red text-[11px] font-bold px-2.5 py-1 rounded-full">
            Out of stock
          </span>
        )}
      </div>

      {/* Food Info */}
      <div className="p-4">
        <h3 className="font-bold text-ink text-base">{food.name}</h3>

        {/* Price Display */}
        <div className="mt-1.5 space-y-0.5">
          {(food.priceType === "scoop" || food.priceType === "both") &&
            food.scoopPrice && (
              <p className="text-sm text-ink-soft">
                <span className="font-semibold">{formatPrice(food.scoopPrice)}</span>
                <span className="text-muted"> / scoop</span>
              </p>
            )}
          {(food.priceType === "plate" || food.priceType === "both") &&
            food.platePrice && (
              <p className="text-sm text-ink-soft">
                <span className="font-semibold">{formatPrice(food.platePrice)}</span>
                <span className="text-muted"> / plate</span>
              </p>
            )}
        </div>

        {/* Status */}
        <div className="mt-2.5 flex items-center gap-1.5">
          {isAvailable && (
            <>
              <span className="w-2 h-2 rounded-full bg-green-bright" />
              <span className="text-xs font-semibold text-green">Available</span>
            </>
          )}
          {isPreorder && (
            <p className="text-xs text-muted">
              Available {food.preorderDate}
              {food.preorderTime ? ` at ${food.preorderTime}` : ""}
            </p>
          )}
          {isOutOfStock && (
            <>
              <span className="w-2 h-2 rounded-full bg-red" />
              <span className="text-xs font-semibold text-red">Out of stock</span>
            </>
          )}
        </div>

        {/* Extras summary */}
        {food.extras.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {requiredExtras.length > 0 && (
              <span className="text-[11px] font-medium bg-green-light text-green px-2 py-0.5 rounded-full">
                {requiredExtras.length} required
              </span>
            )}
            {optionalExtras.length > 0 && (
              <span className="text-[11px] font-medium bg-blue-pastel text-blue-700 px-2 py-0.5 rounded-full">
                {optionalExtras.length} optional
              </span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={() => onEdit(food.id)}
            className="flex-1 text-center text-sm font-semibold text-green bg-green-light hover:bg-green/10 py-2 rounded-xl transition-colors"
          >
            Edit
          </button>
          <button
            onClick={() => onToggleAvailability(food.id)}
            className={`flex-1 text-center text-sm font-semibold py-2 rounded-xl transition-colors ${
              isAvailable || isPreorder
                ? "text-red bg-red/5 hover:bg-red/10"
                : "text-green bg-green-light hover:bg-green/10"
            }`}
          >
            {isAvailable || isPreorder ? "Out of stock" : "Make available"}
          </button>
        </div>
      </div>
    </div>
  );
}
