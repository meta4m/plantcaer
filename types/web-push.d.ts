declare module 'web-push' {
  interface PushSubscription {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  }

  interface RequestDetails {
    headers: Record<string, string>;
    body: string;
    endpoint: string;
    method: string;
    proxy?: string;
  }

  interface SendResult {
    statusCode: number;
    headers: Record<string, string>;
    body: string;
  }

  interface VapidKeys {
    publicKey: string;
    privateKey: string;
  }

  export function setVapidDetails(
    subject: string,
    publicKey: string,
    privateKey: string,
  ): void;

  export function sendNotification(
    subscription: PushSubscription,
    payload: string,
    options?: Record<string, unknown>,
  ): Promise<SendResult>;

  export function generateVAPIDKeys(): VapidKeys;
}
