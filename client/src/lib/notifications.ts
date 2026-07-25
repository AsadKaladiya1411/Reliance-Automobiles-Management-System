import { AxiosError } from "axios";

export type AppNotification = {
  id: string;
  message: string;
  tone: "error" | "success";
};

type Listener = (notification: AppNotification) => void;

const listeners = new Set<Listener>();

type ApiErrorEnvelope = {
  success: false;
  error?: {
    message?: string;
  };
};

export function readableErrorMessage(error: unknown, fallback = "Something went wrong. Please try again.") {
  if (error instanceof AxiosError) {
    const message = (error.response?.data as ApiErrorEnvelope | undefined)?.error?.message;
    return message || error.message || fallback;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

export function notify(notification: Omit<AppNotification, "id">) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const next = { ...notification, id };
  listeners.forEach((listener) => listener(next));
}

export function subscribeNotifications(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
