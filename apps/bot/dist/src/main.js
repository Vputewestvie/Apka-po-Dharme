import { botCommands } from "./commands";
import { botMessages } from "./messages";
import { createMiniAppLaunchLink } from "./mini-app";
import { sendNotification } from "./notifications";
export const botApp = {
    commands: botCommands,
    messages: botMessages,
    createMiniAppLaunchLink,
    sendNotification,
};
