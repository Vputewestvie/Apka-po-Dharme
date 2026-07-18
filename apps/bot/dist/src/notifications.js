export function formatNotification(job) {
    const payload = JSON.parse(job.payload_json || "{}");
    const title = typeof payload.title === "string" ? payload.title : "Практика";
    switch (job.type) {
        case "morning":
            return `Доброе утро. Сегодня: ${title}`;
        case "day":
            return `Следующая практика: ${title}`;
        case "evening":
            return `Вечерняя проверка: ${title}`;
        case "next_practice":
            return `Пора перейти к практике: ${title}`;
        case "timer_finished":
            return `Практика завершена: ${title}`;
    }
}
export async function sendNotification(job, transport) {
    await transport.sendMessage(job.user_id, formatNotification(job));
}
