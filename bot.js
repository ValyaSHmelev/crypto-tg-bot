import 'dotenv/config';
import { Telegraf, Markup } from 'telegraf';
import axios from 'axios';

const bot = new Telegraf(process.env.TG_BOT_TOKEN);
bot.telegram.setMyCommands([
    { command: 'help', description: 'подсказка' },
    { command: 'list', description: 'список монет' },
    { command: 'interval', description: 'изменить интервал' },
    { command: 'current', description: 'текущие курсы' }
])

const chatId = process.env.TG_CHAT_ID;
let watchSymbols = ['TON', 'BTC'];
let interval = 100 * 1000; // Интервал в миллисекундах (например, 1 час)
let intervalId;

async function getPrice(symbol) {
    const url = `https://api.bybit.com/spot/v3/public/quote/trades?symbol=${symbol}USDT&limit=1`;

    try {
        const response = await axios.get(url);
        const data = response.data;

        if (data.result.list && data.result.list.length > 0) {
            const price = data.result.list[0].price;
            return price;
        } else {
            return null;
        }
    } catch (error) {
        console.error('Ошибка при получении данных:', error);
    }
}

async function getPrices(symbols) {
    const prices = {};
    for (const symbol of symbols) {
        const price = await getPrice(symbol);
        if (price) {
            prices[symbol] = price;
        }
    }
    return prices;
}

async function sendPrices() {
    const prices = await getPrices(watchSymbols);
    let message = 'Текущие курсы:\n\n';
    for (const symbol in prices) {
        message += `${symbol}: ${prices[symbol]}\n`;
    }
    bot.telegram.sendMessage(chatId, message);
}

function startInterval() {
    if (intervalId) clearInterval(intervalId);
    intervalId = setInterval(sendPrices, interval);
}

bot.start((ctx) => ctx.reply('Бот запущен!'));

bot.help((ctx) => {
    ctx.reply('Доступные команды:\n\n/add {тикер монеты} - добавить монету\n/rem  {тикер монеты} - удалить монету\n/interval - изменить интервал\n/list - список монет\n/current - текущие курсы');
});

bot.command('add', (ctx) => {
    const symbol = ctx.message.text.split(' ')[1];
    if (symbol && !watchSymbols.includes(symbol)) {
        watchSymbols.push(symbol);
        ctx.reply(`Монета ${symbol} добавлена.`);
    } else {
        ctx.reply('Монета уже отслеживается или не указана.');
    }
});

bot.command('list', (ctx) => {
    const coins = watchSymbols.join('\n');
    ctx.reply(`Отслеживаемые монеты:\n\n${coins}`);
});

bot.command('rem', (ctx) => {
    const symbol = ctx.message.text.split(' ')[1];
    if (symbol && watchSymbols.includes(symbol)) {
        watchSymbols = watchSymbols.filter(s => s !== symbol);
        ctx.reply(`Монета ${symbol} удалена.`);
    } else {
        ctx.reply('Монета не отслеживается или не указана.');
    }
});

bot.command('interval', (ctx) => {
    ctx.reply('Выберите интервал:', Markup.inlineKeyboard([
        [Markup.button.callback('1 минута', 'set_interval_1min')],
        [Markup.button.callback('10 минут', 'set_interval_10min')],
        [Markup.button.callback('1 час', 'set_interval_1hour')],
        [Markup.button.callback('6 часов', 'set_interval_6hours')],
        [Markup.button.callback('12 часов', 'set_interval_12hours')]
    ]));
});

bot.command('current', (ctx) => {
    sendPrices();
})

bot.action(/set_interval_(.+)/, async (ctx) => {
    const time = ctx.match[1];
    const intervals = {
        '1min': 60 * 1000,
        '10min': 10 * 60 * 1000,
        '1hour': 60 * 60 * 1000,
        '6hours': 6 * 60 * 60 * 1000,
        '12hours': 12 * 60 * 60 * 1000
    };

    if (intervals[time]) {
        interval = intervals[time];
        startInterval();
        // Удаление клавиатуры
        await ctx.editMessageReplyMarkup({ reply_markup: { remove_keyboard: true } });
        await ctx.reply(`Интервал обновлен на ${time}.`);
    } else {
        ctx.reply('Неверный интервал.');
    }
});

bot.launch();
startInterval();
