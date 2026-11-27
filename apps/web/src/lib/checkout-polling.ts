import { shouldPollCheckout, type CheckoutStatusResponse } from './checkout';

const POLL_DELAY_MS = 3000;

type CheckoutPollingOptions = {
  request: () => Promise<CheckoutStatusResponse | undefined>;
  onStatus: (status: CheckoutStatusResponse) => void;
  onError: (error: unknown) => void;
};

export function startCheckoutPolling({ request, onStatus, onError }: CheckoutPollingOptions) {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  async function check() {
    if (stopped) return;
    try {
      const status = await request();
      if (stopped) return;
      if (status) {
        onStatus(status);
        if (!shouldPollCheckout(status.checkoutState)) return;
      }
      // An unavailable action lock or a hidden tab defers the request.
      timer = setTimeout(check, POLL_DELAY_MS);
    } catch (error) {
      if (!stopped) onError(error);
    }
  }

  // Let a Strict Mode setup/cleanup discard its first cycle before any request.
  queueMicrotask(() => void check());
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}
