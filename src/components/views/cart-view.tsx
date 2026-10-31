"use client";
/**
 * Cart (v63 "cart" view) and the cart lines used again on checkout.
 * Fix: every line uses the same grid, so the +/− buttons and totals line up.
 */
import Link from "next/link";
import { useApp, useCartLines } from "@/components/providers";
import { PageHead } from "@/components/page-head";
import { formatMoney } from "@/lib/money";

export function CartLines() {
  const lines = useCartLines();
  const { addToCart, removeFromCart } = useApp();
  return (
    <>
      {lines.map(({ item, quantity }) => (
        <div className="row cart-line" key={item.id}>
          <div>
            <h3>{item.name}</h3>
            <p>{formatMoney(item.priceKobo)} each</p>
          </div>
          <div className="quantity">
            <button type="button" aria-label={`Remove one ${item.name}`} onClick={() => removeFromCart(item.id)}>
              −
            </button>
            <span>{quantity}</span>
            <button type="button" aria-label={`Add one ${item.name}`} onClick={() => addToCart(item.id)}>
              +
            </button>
          </div>
          <strong>{formatMoney(item.priceKobo * quantity)}</strong>
        </div>
      ))}
    </>
  );
}

export function CartView() {
  const { cartTotalKobo } = useApp();
  return (
    <>
      <PageHead
        title="Your cart"
        sub="Review your meals before choosing a pickup time."
        action={
          <Link className="text-btn" href="/menu">
            Add more items →
          </Link>
        }
      />
      <div className="panel cart">
        {cartTotalKobo ? (
          <>
            <CartLines />
            <div className="row total">
              <span>Total</span>
              <span>{formatMoney(cartTotalKobo)}</span>
            </div>
            <Link className="btn full" href="/checkout">
              Continue to checkout →
            </Link>
          </>
        ) : (
          <div className="empty">
            <h2>Your tray is empty</h2>
            <p>Add a meal to get started.</p>
            <Link className="btn" href="/menu">
              Browse menu
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
