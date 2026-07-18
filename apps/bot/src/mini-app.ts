export type MiniAppLaunchLink = {
  text: string;
  url: string;
};

export type MiniAppButton = {
  text: string;
  reply_markup: {
    inline_keyboard: Array<
      Array<{
        text: string;
        web_app: {
          url: string;
        };
      }>
    >;
  };
};

export function createMiniAppLaunchLink(baseUrl: string, screen?: string): MiniAppLaunchLink {
  const url = new URL(baseUrl);
  if (screen) {
    url.searchParams.set("screen", screen);
  }

  return {
    text: "Открыть Mini App",
    url: url.toString(),
  };
}

export function createMiniAppButton(baseUrl: string, screen?: string): MiniAppButton {
  const link = createMiniAppLaunchLink(baseUrl, screen);
  return {
    text: link.text,
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: link.text,
            web_app: {
              url: link.url,
            },
          },
        ],
      ],
    },
  };
}
