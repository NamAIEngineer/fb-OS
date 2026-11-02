declare namespace chrome {
  namespace runtime {
    interface MessageSender {
      readonly id?: string;
      readonly url?: string;
    }

    interface PortMessageListener {
      (
        message: unknown,
        sender: MessageSender,
        sendResponse: (response: unknown) => void
      ): boolean | void;
    }

    const onMessage: {
      addListener(listener: PortMessageListener): void;
    };

    const lastError: { readonly message?: string } | undefined;

    function sendMessage(
      message: unknown,
      callback?: (response: unknown) => void
    ): void;
  }
}
