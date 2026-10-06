import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface QuoteItem {
  /** The product it came from, so the same one is not added twice. */
  productId: number;
  code: string;
  /** The size and thickness the customer chose, exactly as it should read in the enquiry. */
  detail: string;
  quantity: number;
}

/**
 * The basket for a business that quotes rather than sells.
 *
 * A customer does not buy one thing: they want a tube, the bends that go with it, a sheet and some
 * flat bar. Today that is four separate WhatsApp messages or one long one typed by hand. Adding
 * each product to a list means the enquiry arrives complete, and the shop can price it in one go.
 *
 * Held in localStorage because there is no account to attach it to, and a customer interrupted
 * half way through should find their list still there when they come back.
 *
 * Server-side rendering is why every storage call is guarded: this module is loaded during the
 * prerender, where `localStorage` does not exist.
 */
@Injectable({ providedIn: 'root' })
export class QuoteListService {
  private readonly key = 'quote-list';

  private storage(): Storage | null {
    try {
      return typeof localStorage === 'undefined' ? null : localStorage;
    } catch {
      return null;
    }
  }

  /** Everything on the list, read fresh each time so two tabs cannot drift apart. */
  items(): QuoteItem[] {
    const raw = this.storage()?.getItem(this.key);
    if (!raw) {
      return [];
    }
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as QuoteItem[]) : [];
    } catch {
      // A corrupted entry must not take the page down with it.
      this.storage()?.removeItem(this.key);
      return [];
    }
  }

  count(): number {
    return this.items().reduce((total, item) => total + (item.quantity || 1), 0);
  }

  has(productId: number): boolean {
    return this.items().some((item) => item.productId === productId);
  }

  /**
   * Adds, or raises the quantity if the same thing is already on the list.
   *
   * Matched on the product *and* the dimension, not the product alone: 15x15 in 1.3 mm and 15x15 in
   * 1.5 mm are two things to quote, and the first version of this folded them into one line with a
   * quantity of two.
   */
  add(item: QuoteItem): QuoteItem[] {
    const items = this.items();
    const existing = items.find(
      (other) => other.productId === item.productId && (other.detail || '') === (item.detail || '')
    );
    if (existing) {
      existing.quantity += item.quantity || 1;
    } else {
      items.push({ ...item, quantity: item.quantity || 1 });
    }
    return this.save(items);
  }

  remove(productId: number): QuoteItem[] {
    return this.save(this.items().filter((item) => item.productId !== productId));
  }

  /**
   * Sets the quantity of one line.
   *
   * Matched on the product *and* the dimension, like `add`, because 15x15 in 1.3 mm and 15x15 in
   * 1.5 mm are two lines - and a − beside the wrong one must not touch the other. Dropping to zero
   * removes that line and leaves its neighbour alone.
   */
  setQuantity(item: QuoteItem, quantity: number): QuoteItem[] {
    const wanted = Math.floor(Number(quantity));
    const items = this.items();
    const at = items.findIndex(
      (other) => other.productId === item.productId && (other.detail || '') === (item.detail || '')
    );
    if (!Number.isFinite(wanted) || wanted < 1) {
      // Zero takes that line off and leaves its neighbours where they are.
      return this.save(at >= 0 ? items.filter((_other, index) => index !== at) : items);
    }
    if (at >= 0) {
      // Changed where it stands. This used to remove the line and push it to the end, which quietly
      // reordered the list every time a quantity was edited: the customer typed a new number against
      // their first item and found it at the bottom. The list reads in the order things went in, and
      // editing one must not move it.
      items[at] = { ...items[at], quantity: wanted };
    } else {
      items.push({ ...item, quantity: wanted });
    }
    return this.save(items);
  }

  clear(): void {
    this.storage()?.removeItem(this.key);
  }

  private save(items: QuoteItem[]): QuoteItem[] {
    this.storage()?.setItem(this.key, JSON.stringify(items));
    // Tell anyone listening. The navigation's counter used to refresh only on a route change, so
    // adding from a card - which does not navigate - left it showing the old number.
    this.changes.next(items);
    return items;
  }

  /** Emits the list whenever it changes. */
  readonly changes = new BehaviorSubject<QuoteItem[]>([]);
}
