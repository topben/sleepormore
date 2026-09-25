// Modal focus survives DOM replacement (settings, translations and share previews).
const CONTROLS = 'button, a[href], input, select, textarea, [tabindex]';

function controls(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(CONTROLS)).filter(
    (el) => el.tabIndex >= 0 && !el.matches(':disabled') && !el.closest('[hidden], .hidden, [inert]'),
  );
}

export interface FocusBookmark {
  element: HTMLElement;
  index: number;
}

export function rememberFocus(root: HTMLElement): FocusBookmark | null {
  const element = document.activeElement;
  return element instanceof HTMLElement && root.contains(element) ? { element, index: controls(root).indexOf(element) } : null;
}

function findFocus(root: HTMLElement, saved: FocusBookmark | null): HTMLElement | undefined {
  const candidates = controls(root);
  if (!saved) return candidates[0];
  if (candidates.includes(saved.element)) return saved.element;
  // Stable keys and classes also work when translated text or preview buttons change.
  for (const attr of ['id', 'data-id', 'data-locale', 'data-combo']) {
    const value = saved.element.getAttribute(attr);
    if (value) {
      const found = candidates.find((el) => el.getAttribute(attr) === value);
      if (found) return found;
    }
  }
  const classes = [...saved.element.classList];
  const matches = classes.length
    ? candidates.filter((el) => el.tagName === saved.element.tagName && classes.every((name) => el.classList.contains(name)))
    : [];
  return matches.length === 1 ? matches[0] : candidates[saved.index] ?? candidates[0];
}

export function restoreFocus(root: HTMLElement, saved: FocusBookmark | null): void {
  if (saved) findFocus(root, saved)?.focus({ preventScroll: true });
}

export class DialogFocus {
  private dialog: HTMLElement | null = null;
  private opener: FocusBookmark | null = null;
  private inert = new Map<HTMLElement, boolean>();
  private revision = 0;

  constructor(private readonly root: HTMLElement) {}

  capture(): FocusBookmark | null {
    return this.dialog ? rememberFocus(this.dialog) : null;
  }

  activate(dialog: HTMLElement, saved: FocusBookmark | null = null, initial?: HTMLElement): void {
    if (!this.dialog) {
      this.opener = rememberFocus(this.root);
      document.addEventListener('focusin', this.contain);
      for (const child of this.root.children) {
        if (!(child instanceof HTMLElement) || child.contains(dialog)) continue;
        this.inert.set(child, child.inert);
        child.inert = true;
      }
    }
    this.dialog = dialog;
    dialog.tabIndex = -1;
    dialog.setAttribute('aria-modal', 'true');
    dialog.addEventListener('keydown', this.onKey);
    const revision = ++this.revision;
    const focus = () => (saved ? findFocus(dialog, saved) : initial ?? findFocus(dialog, null))?.focus({ preventScroll: true });
    focus();
    // Screen factories queue their own default focus. Restore the current control after them.
    queueMicrotask(() => {
      if (revision === this.revision && dialog.isConnected) focus();
    });
  }

  close(restore = true): void {
    this.revision++;
    this.dialog = null;
    document.removeEventListener('focusin', this.contain);
    for (const [el, inert] of this.inert) el.inert = inert;
    this.inert.clear();
    if (restore) restoreFocus(this.root, this.opener);
    this.opener = null;
  }

  private contain = (event: FocusEvent): void => {
    const dialog = this.dialog;
    if (dialog?.isConnected && event.target instanceof Node && !dialog.contains(event.target)) {
      (findFocus(dialog, null) ?? dialog).focus({ preventScroll: true });
    }
  };

  private onKey = (event: KeyboardEvent): void => {
    const dialog = this.dialog;
    if (event.key !== 'Tab' || !dialog) return;
    const available = controls(dialog);
    const index = available.indexOf(document.activeElement as HTMLElement);
    if (!available.length || index < 0 || (event.shiftKey ? index === 0 : index === available.length - 1)) {
      event.preventDefault();
      (available[event.shiftKey ? available.length - 1 : 0] ?? dialog).focus({ preventScroll: true });
    }
  };
}
