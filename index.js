const { Telegraf, Markup } = require('telegraf');
const fs = require('fs').promises;
const express = require('express');

// Создаем экземпляр бота
const bot = new Telegraf(process.env.BOT_TOKEN);

// Создаем экземпляр Express
const app = express();

// ID администратора (ваш Telegram ID)
const ADMIN_ID = process.env.ADMIN_ID;

// Путь к файлу с пользователями
const USERS_FILE = 'users.json';

// Функция для загрузки пользователей
async function loadUsers() {
  try {
    const data = await fs.readFile(USERS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading users:', error);
    return {};
  }
}

// Функция для сохранения пользователей
async function saveUsers(users) {
  try {
    await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
  } catch (error) {
    console.error('Error saving users:', error);
  }
}

// Обработка команды /start
bot.command('start', async (ctx) => {
  const userId = ctx.from.id.toString();
  const username = ctx.from.username || 'Unknown';
  
  // Загружаем пользователей и добавляем нового
  const users = await loadUsers();
  users[userId] = { username, joinedAt: new Date().toISOString() };
  await saveUsers(users);

  // Отправляем приветственное сообщение с кнопкой
  ctx.reply('Добро пожаловать!', Markup.inlineKeyboard([
    Markup.button.webApp('Открыть WebApp', 'https://your-webapp-url.com')
  ]));
});

// Функция для рассылки сообщений
async function broadcastMessage(message) {
  const users = await loadUsers();
  for (const userId in users) {
    try {
      await bot.telegram.sendMessage(userId, message);
    } catch (error) {
      console.error(`Error sending message to user ${userId}:`, error);
    }
  }
}

// Обработка команды /admin (доступна только администратору)
bot.command('admin', (ctx) => {
  if (ctx.from.id.toString() !== ADMIN_ID) {
    return ctx.reply('У вас нет доступа к этой команде.');
  }

  ctx.reply('Админ-панель', Markup.keyboard([
    ['📢 Сделать рассылку'],
    ['👥 Количество пользователей']
  ]).resize());
});

// Обработка кнопки "Сделать рассылку"
bot.hears('📢 Сделать рассылку', (ctx) => {
  if (ctx.from.id.toString() !== ADMIN_ID) return;

  ctx.reply('Введите текст для рассылки:');
  ctx.session = { awaitingBroadcast: true };
});

// Обработка кнопки "Количество пользователей"
bot.hears('👥 Количество пользователей', async (ctx) => {
  if (ctx.from.id.toString() !== ADMIN_ID) return;

  const users = await loadUsers();
  const count = Object.keys(users).length;
  ctx.reply(`Количество пользователей: ${count}`);
});

// Обработка текста рассылки
bot.on('text', async (ctx) => {
  if (ctx.from.id.toString() !== ADMIN_ID) return;
  if (ctx.session?.awaitingBroadcast) {
    ctx.session.awaitingBroadcast = false;
    await broadcastMessage(ctx.message.text);
    ctx.reply('Рассылка выполнена!');
  }
});

// Webhook endpoint
app.post(`/webhook/${process.env.BOT_TOKEN}`, (req, res) => {
  bot.handleUpdate(req.body, res);
});

// Запускаем Express сервер
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Экспортируем приложение Express для Vercel
module.exports = app;
