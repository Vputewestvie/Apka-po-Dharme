import { createMiniAppLaunchLink } from "./mini-app";
import { sendNotification } from "./notifications";
export declare const botApp: {
    commands: import("./commands").BotCommand[];
    messages: {
        readonly start: "Mini App ready to open.";
        readonly help: "Use the button to open the app.";
        readonly today: "Open today's practice in Mini App.";
        readonly schedule: "Open schedule in Mini App.";
    };
    createMiniAppLaunchLink: typeof createMiniAppLaunchLink;
    sendNotification: typeof sendNotification;
};
//# sourceMappingURL=main.d.ts.map