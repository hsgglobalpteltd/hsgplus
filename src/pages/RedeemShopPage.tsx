import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  MapPin,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
  Truck,
  ShieldAlert,
} from 'lucide-react';
import { useHsgData } from '../context/HsgDataContext';
import { MerchItem } from '../types';

interface RedeemShopPageProps {
  onBack: () => void;
}

interface CartEntry {
  merchId: string;
  qty: number;
  payWith: 'points' | 'cashback';
}

export const RedeemShopPage: React.FC<RedeemShopPageProps> = ({ onBack }) => {
  const { db, isAuthenticated, openLoginModal, checkoutRedeemCart } = useHsgData();

  // Attractive mock values shown when user is not logged in
  const MOCK_USER_CASH = 55.0;
  const MOCK_USER_PTS = 1980;

  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [step, setStep] = useState<'shop' | 'checkout' | 'done'>('shop');
  const [cart, setCart] = useState<Record<string, CartEntry>>({});
  const [fulfillment, setFulfillment] = useState<'collect' | 'delivery'>(
    'collect'
  );
  const [deliveryAddress, setDeliveryAddress] = useState<string>(
    db.user?.address || ''
  );
  const [pickupConfirmed, setPickupConfirmed] = useState<boolean>(true);
  const [lastOrderMessage, setLastOrderMessage] = useState<string>('');
  const [isPlacingOrder, setIsPlacingOrder] = useState<boolean>(false);
  const [showPrivacyConfirm, setShowPrivacyConfirm] = useState<boolean>(false);

  const isPrivacyOn = Boolean(db.user?.privacy?.mode ?? db.user?.privacy_mode ?? true);

  const userPts = isAuthenticated && db.user
    ? Number(db.user?.points_balance || 0)
    : MOCK_USER_PTS;
  const userCash = isAuthenticated && db.user
    ? Number(db.user?.wallet_balance || 0)
    : MOCK_USER_CASH;
  const deliveryFee = Number(db.settings.delivery_fee || 0);
  const pickupAddress =
    db.settings.self_collect_address || 'HSG Global HQ, Singapore';

  const categories = useMemo(() => {
    const set = new Set<string>();
    db.merch_catalog.forEach((item) => {
      const c = (item.category || '').trim();
      if (c) set.add(c);
    });
    return ['All', ...Array.from(set)];
  }, [db.merch_catalog]);

  const filteredCatalog = useMemo(() => {
    return db.merch_catalog.filter((item) => {
      if (categoryFilter === 'All') return true;
      const c = (item.category || '').trim();
      return c.toLowerCase() === categoryFilter.toLowerCase();
    });
  }, [db.merch_catalog, categoryFilter]);

  const getDefaultPayWith = (item: MerchItem): 'points' | 'cashback' => {
    const mode = item.redeem_mode || 'both';
    if (mode === 'cashback_only') return 'cashback';
    return 'points';
  };

  const handleAddToCart = (item: MerchItem) => {
    if (!isAuthenticated) {
      openLoginModal();
      return;
    }
    setCart((prev) => {
      const existing = prev[item.id];
      const nextQty = (existing?.qty || 0) + 1;
      return {
        ...prev,
        [item.id]: {
          merchId: item.id,
          qty: nextQty,
          payWith: existing?.payWith || getDefaultPayWith(item),
        },
      };
    });
  };

  const handleUpdateQty = (merchId: string, delta: number) => {
    setCart((prev) => {
      const existing = prev[merchId];
      if (!existing) return prev;
      const nextQty = existing.qty + delta;
      if (nextQty <= 0) {
        const copy = { ...prev };
        delete copy[merchId];
        return copy;
      }
      return {
        ...prev,
        [merchId]: {
          ...existing,
          qty: nextQty,
        },
      };
    });
  };

  const handleSetPayWith = (
    merchId: string,
    payWith: 'points' | 'cashback'
  ) => {
    setCart((prev) => {
      const existing = prev[merchId];
      if (!existing) return prev;
      return {
        ...prev,
        [merchId]: {
          ...existing,
          payWith,
        },
      };
    });
  };

  const handleSetAllPayWith = (payWith: 'points' | 'cashback') => {
    setCart((prev) => {
      const next: Record<string, CartEntry> = {};
      for (const [id, entry] of Object.entries(prev)) {
        const item = db.merch_catalog.find((m) => m.id === id);
        const mode = item?.redeem_mode || 'both';
        next[id] = {
          ...entry,
          payWith:
            mode === 'points_only'
              ? 'points'
              : mode === 'cashback_only'
              ? 'cashback'
              : payWith,
        };
      }
      return next;
    });
  };

  const cartList = useMemo(() => {
    return Object.values(cart)
      .map((entry) => {
        const item = db.merch_catalog.find((m) => m.id === entry.merchId);
        return item ? { ...entry, item } : null;
      })
      .filter(Boolean) as Array<CartEntry & { item: MerchItem }>;
  }, [cart, db.merch_catalog]);

  const totalCartQty = useMemo(
    () => cartList.reduce((acc, row) => acc + row.qty, 0),
    [cartList]
  );

  const totals = useMemo(() => {
    let points = 0;
    let cashItems = 0;
    for (const row of cartList) {
      const mode = row.item.redeem_mode || 'both';
      const actualPayWith =
        mode === 'points_only'
          ? 'points'
          : mode === 'cashback_only'
          ? 'cashback'
          : row.payWith;
      const ptsPrice = Number(
        row.item.price_points ?? Math.round(row.item.price * 10)
      );
      if (actualPayWith === 'points') {
        points += ptsPrice * row.qty;
      } else {
        cashItems += row.item.price * row.qty;
      }
    }
    const fee = fulfillment === 'delivery' && cartList.length > 0 ? deliveryFee : 0;
    const totalCash = Number((cashItems + fee).toFixed(2));
    return {
      points,
      cashItems: Number(cashItems.toFixed(2)),
      deliveryFee: fee,
      totalCash,
      insufficientPoints: points > userPts,
      insufficientCash: totalCash > userCash,
    };
  }, [cartList, fulfillment, deliveryFee, userPts, userCash]);

  const executeOrderCheckout = async () => {
    if (cartList.length === 0 || isPlacingOrder) return;
    if (fulfillment === 'collect' && !pickupConfirmed) return;

    setIsPlacingOrder(true);
    setShowPrivacyConfirm(false);
    try {
      const res = await checkoutRedeemCart({
        items: cartList.map((c) => ({
          merchId: c.merchId,
          qty: c.qty,
          payWith: c.payWith,
        })),
        fulfillment,
        deliveryAddress: deliveryAddress.trim(),
      });

      if (res.ok) {
        setLastOrderMessage(res.message);
        setCart({});
        setStep('done');
      }
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const handleConfirmCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cartList.length === 0 || isPlacingOrder) return;
    if (fulfillment === 'collect' && !pickupConfirmed) return;

    if (isPrivacyOn) {
      setShowPrivacyConfirm(true);
      return;
    }

    await executeOrderCheckout();
  };

  return (
    <div className="w-full px-5 pt-2 pb-24 space-y-4">
      {/* TOP HEADER */}
      <div className="relative flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            if (step === 'checkout') {
              setStep('shop');
            } else {
              onBack();
            }
          }}
          title="Back"
          className="w-9 h-9 rounded-full bg-white text-[#141416] flex items-center justify-center shadow-2xs active:scale-95 transition"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <span className="absolute left-1/2 -translate-x-1/2 text-sm font-extrabold text-[#141416] pointer-events-none">
          {step === 'checkout' ? 'Checkout Order' : 'HSG+ Shop'}
        </span>

        <button
          type="button"
          onClick={() => {
            if (!isAuthenticated) {
              openLoginModal();
              return;
            }
            if (totalCartQty > 0) {
              setStep((prev) => (prev === 'checkout' ? 'shop' : 'checkout'));
            }
          }}
          className="h-9 px-3 rounded-full bg-white text-[#141416] text-xs font-extrabold flex items-center gap-1.5 shadow-2xs active:scale-95 transition cursor-pointer"
        >
          <ShoppingBag className="w-3.5 h-3.5 text-[#EC008C]" />
          <span>{totalCartQty}</span>
        </button>
      </div>

      {/* COMPACT BALANCE BAR */}
      <div className="w-full px-4 py-3 rounded-2xl bg-[#141416] text-white flex items-center justify-between shadow-xs">
        <div>
          <div className="text-[10px] text-zinc-400 font-semibold">
            Cashback Balance
          </div>
          <div className="text-sm font-extrabold text-[#FFEA00]">
            ${userCash.toFixed(2)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-zinc-400 font-semibold">
            Available Points
          </div>
          <div className="text-sm font-extrabold text-white">
            {userPts} <span className="text-[11px] text-[#FFEA00]">pts</span>
          </div>
        </div>
      </div>

      {step === 'done' ? (
        <div className="w-full p-6 rounded-3xl bg-white text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-[#141416] text-[#FFEA00] flex items-center justify-center mx-auto">
            <Check className="w-6 h-6" />
          </div>
          <h2 className="text-base font-extrabold text-[#141416]">
            Order Placed Successfully!
          </h2>
          <p className="text-xs text-zinc-500 leading-relaxed">
            {lastOrderMessage}
          </p>
          <div className="pt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setStep('shop')}
              className="flex-1 h-10 rounded-full bg-[#F6F6F9] text-[#141416] text-xs font-bold"
            >
              Back to Shop
            </button>
            <button
              type="button"
              onClick={onBack}
              className="flex-1 h-10 rounded-full bg-[#EC008C] text-white text-xs font-bold"
            >
              View Wallet
            </button>
          </div>
        </div>
      ) : step === 'shop' ? (
        <>
          {/* CATEGORY FILTER PILLS */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {categories.map((cat) => {
              const active = categoryFilter === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`h-8 px-4 rounded-full text-xs font-bold transition shrink-0 ${
                    active
                      ? 'bg-[#141416] text-[#FFEA00]'
                      : 'bg-white text-zinc-600'
                  }`}
                >
                  {cat === 'All' ? 'All Items' : cat}
                </button>
              );
            })}
          </div>

          {/* 2 CARDS IN ONE ROW SHOP GRID */}
          {filteredCatalog.length === 0 ? (
            <div className="w-full p-8 rounded-3xl bg-white text-center text-xs text-zinc-400">
              No products available right now.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filteredCatalog.map((item) => {
                const mode = item.redeem_mode || 'both';
                const ptsPrice = Number(
                  item.price_points ?? Math.round(item.price * 10)
                );
                const cat = item.category?.trim() || 'Item';
                const inCart = cart[item.id];

                return (
                  <div
                    key={item.id}
                    className="rounded-3xl bg-white p-3 shadow-xs border border-zinc-200/60 flex flex-col justify-between"
                  >
                    <div>
                      <div className="w-full aspect-square rounded-2xl bg-[#F6F6F9] overflow-hidden relative mb-2.5">
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.name}
                            className={`w-full h-full ${
                              item.image_url.includes('hsg-bottle')
                                ? 'object-contain p-3'
                                : 'object-cover'
                            }`}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[11px] text-zinc-400">
                            No Photo
                          </div>
                        )}
                        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-white/90 text-[#141416] text-[9px] font-bold">
                          {cat}
                        </span>
                      </div>

                      <h3 className="text-xs font-extrabold text-[#141416] line-clamp-2 leading-snug">
                        {item.name}
                      </h3>

                      <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[11px]">
                        {(mode === 'both' || mode === 'points_only') && (
                          <span className="font-extrabold text-[#141416]">
                            {ptsPrice} pts
                          </span>
                        )}
                        {mode === 'both' && (
                          <span className="text-zinc-400 text-[10px]">or</span>
                        )}
                        {(mode === 'both' || mode === 'cashback_only') && (
                          <span className="font-extrabold text-[#EC008C]">
                            ${item.price.toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-zinc-100">
                      {!inCart ? (
                        <button
                          type="button"
                          onClick={() => handleAddToCart(item)}
                          className="w-full h-8 rounded-full bg-[#141416] text-[#FFEA00] text-[11px] font-bold flex items-center justify-center gap-1 active:scale-95 transition"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add to Cart</span>
                        </button>
                      ) : (
                        <div className="flex items-center justify-between bg-[#F6F6F9] rounded-full p-1">
                          <button
                            type="button"
                            onClick={() => handleUpdateQty(item.id, -1)}
                            className="w-6 h-6 rounded-full bg-white text-[#141416] flex items-center justify-center shadow-2xs"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-xs font-extrabold text-[#141416]">
                            {inCart.qty}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateQty(item.id, 1)}
                            className="w-6 h-6 rounded-full bg-[#141416] text-[#FFEA00] flex items-center justify-center shadow-2xs"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        /* CHECKOUT & CONFIRMATION STEP */
        <form onSubmit={handleConfirmCheckout} className="space-y-4">
          {/* 1. CART ITEMS & PAYMENT METHOD */}
          <div className="w-full p-4 rounded-3xl bg-white shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-[#141416]">
                1. Your Cart ({totalCartQty} item{totalCartQty === 1 ? '' : 's'})
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleSetAllPayWith('points')}
                  className="px-2.5 py-1 rounded-full bg-[#F6F6F9] hover:bg-zinc-200 text-[10px] font-bold text-[#141416]"
                >
                  Use Points
                </button>
                <button
                  type="button"
                  onClick={() => handleSetAllPayWith('cashback')}
                  className="px-2.5 py-1 rounded-full bg-[#F6F6F9] hover:bg-zinc-200 text-[10px] font-bold text-[#EC008C]"
                >
                  Use Cashback
                </button>
              </div>
            </div>

            <div className="space-y-2.5">
              {cartList.map((row) => {
                const mode = row.item.redeem_mode || 'both';
                const ptsPrice = Number(
                  row.item.price_points ?? Math.round(row.item.price * 10)
                );
                return (
                  <div
                    key={row.merchId}
                    className="p-3 rounded-2xl bg-[#F6F6F9] space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={row.item.image_url}
                          alt={row.item.name}
                          className="w-11 h-11 rounded-xl bg-white object-cover shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-[#141416] truncate">
                            {row.item.name}
                          </div>
                          <div className="text-[11px] font-semibold text-zinc-500">
                            {row.payWith === 'points'
                              ? `${ptsPrice * row.qty} pts`
                              : `$${(row.item.price * row.qty).toFixed(2)} Cashback`}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(row.merchId, -1)}
                          className="w-6 h-6 rounded-full bg-white text-[#141416] flex items-center justify-center"
                        >
                          {row.qty === 1 ? (
                            <Trash2 className="w-3 h-3 text-rose-500" />
                          ) : (
                            <Minus className="w-3 h-3" />
                          )}
                        </button>
                        <span className="w-5 text-center text-xs font-extrabold">
                          {row.qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(row.merchId, 1)}
                          className="w-6 h-6 rounded-full bg-[#141416] text-[#FFEA00] flex items-center justify-center"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Choose Deduct from Points or Cashback per item when mode === 'both' */}
                    {mode === 'both' && (
                      <div className="grid grid-cols-2 gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => handleSetPayWith(row.merchId, 'points')}
                          className={`h-7 rounded-lg text-[10px] font-bold transition ${
                            row.payWith === 'points'
                              ? 'bg-[#141416] text-[#FFEA00]'
                              : 'bg-white text-zinc-600'
                          }`}
                        >
                          Deduct {ptsPrice * row.qty} pts
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleSetPayWith(row.merchId, 'cashback')
                          }
                          className={`h-7 rounded-lg text-[10px] font-bold transition ${
                            row.payWith === 'cashback'
                              ? 'bg-[#EC008C] text-white'
                              : 'bg-white text-zinc-600'
                          }`}
                        >
                          Use ${(row.item.price * row.qty).toFixed(2)} Cashback
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2. CONFIRM FULFILLMENT: SELF-PICKUP OR DELIVERY ADDRESS */}
          <div className="w-full p-4 rounded-3xl bg-white shadow-xs space-y-3">
            <span className="text-xs font-extrabold text-[#141416] block">
              2. Confirm Pickup or Delivery Address
            </span>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFulfillment('collect')}
                className={`h-10 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                  fulfillment === 'collect'
                    ? 'bg-[#141416] text-[#FFEA00]'
                    : 'bg-[#F6F6F9] text-zinc-600'
                }`}
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>Self-Pickup (Free)</span>
              </button>
              <button
                type="button"
                onClick={() => setFulfillment('delivery')}
                className={`h-10 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                  fulfillment === 'delivery'
                    ? 'bg-[#141416] text-[#FFEA00]'
                    : 'bg-[#F6F6F9] text-zinc-600'
                }`}
              >
                <Truck className="w-3.5 h-3.5" />
                <span>Delivery (+${deliveryFee.toFixed(2)})</span>
              </button>
            </div>

            {fulfillment === 'collect' ? (
              <label className="p-3 rounded-2xl bg-[#F6F6F9] flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pickupConfirmed}
                  onChange={(e) => setPickupConfirmed(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-[#141416] shrink-0"
                />
                <div className="text-xs">
                  <div className="font-bold text-[#141416]">
                    Confirm Self-Pickup Location
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-0.5">
                    {pickupAddress}
                  </div>
                </div>
              </label>
            ) : (
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-zinc-600">
                  Delivery Address (Required)
                </label>
                <textarea
                  rows={2}
                  required
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder="Enter full Singapore address & postal code..."
                  className="w-full p-3 rounded-2xl bg-[#F6F6F9] text-xs font-semibold text-[#141416] focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* 3. PAYMENT SUMMARY & CONFIRM BUTTON */}
          <div className="w-full p-4 rounded-3xl bg-white shadow-xs space-y-3">
            <span className="text-xs font-extrabold text-[#141416] block">
              3. Order Payment Summary
            </span>

            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Deduct from Points:</span>
                <span className="font-extrabold text-[#141416]">
                  {totals.points} pts
                </span>
              </div>
              {totals.insufficientPoints && (
                <div className="text-[10px] font-semibold text-rose-500 text-right">
                  Insufficient pt balance (available: {userPts} pts)
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-zinc-500">
                  Deduct from Cashback
                  {totals.deliveryFee > 0
                    ? ` (incl. $${totals.deliveryFee.toFixed(2)} delivery)`
                    : ''}
                  :
                </span>
                <span className="font-extrabold text-[#EC008C]">
                  ${totals.totalCash.toFixed(2)}
                </span>
              </div>
              {totals.insufficientCash && (
                <div className="text-[10px] font-semibold text-rose-500 text-right">
                  Insufficient cashback balance (available: ${userCash.toFixed(2)})
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={
                isPlacingOrder ||
                totals.insufficientPoints ||
                totals.insufficientCash ||
                (fulfillment === 'collect' && !pickupConfirmed)
              }
              className="w-full h-11 rounded-full bg-[#EC008C] text-white text-xs font-extrabold shadow-sm disabled:opacity-45 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              {isPlacingOrder ? 'Placing Order...' : 'Place Order Now'}
            </button>
          </div>
        </form>
      )}

      {/* FLOATING BOTTOM CART BAR ON SHOP GRID */}
      {step === 'shop' && totalCartQty > 0 && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-[calc(100%-2.5rem)] max-w-[390px] z-30">
          <button
            type="button"
            onClick={() => setStep('checkout')}
            className="w-full h-12 px-5 rounded-full bg-[#141416] text-white shadow-xl flex items-center justify-between text-xs font-extrabold"
          >
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#FFEA00] text-[#141416] flex items-center justify-center text-[11px] font-black">
                {totalCartQty}
              </span>
              <span>View Cart & Checkout</span>
            </div>
            <span className="text-[#FFEA00]">
              {totals.points > 0 ? `${totals.points} pts` : ''}
              {totals.points > 0 && totals.totalCash > 0 ? ' + ' : ''}
              {totals.totalCash > 0 ? `$${totals.totalCash.toFixed(2)}` : ''}
              {totals.points === 0 && totals.totalCash === 0 ? '0 pts' : ''} →
            </span>
          </button>
        </div>
      )}
      {/* PRIVACY SHARING CONFIRMATION MODAL */}
      {showPrivacyConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-zinc-100 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-[#141416]">
                  Confirm Order &amp; Delivery Phone
                </h3>
                <p className="text-[11px] text-zinc-500">
                  Privacy mode active
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-zinc-700 leading-relaxed">
              Your phone number will be shared to HSG+ for delivery purpose.
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                disabled={isPlacingOrder}
                onClick={() => setShowPrivacyConfirm(false)}
                className="flex-1 h-11 rounded-full border border-zinc-200 bg-white hover:bg-zinc-50 font-bold text-xs text-zinc-700 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPlacingOrder}
                onClick={executeOrderCheckout}
                className="flex-1 h-11 rounded-full bg-[#EC008C] text-white hover:bg-[#d4007d] font-extrabold text-xs shadow-md transition cursor-pointer flex items-center justify-center"
              >
                {isPlacingOrder ? 'Submitting...' : 'Submit Order'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
