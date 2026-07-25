import { MutationCache, QueryClient } from "@tanstack/react-query";
import { notify, readableErrorMessage } from "./notifications";

export const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onError: (error) => {
      notify({ tone: "error", message: readableErrorMessage(error) });
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
