/* ============================================================
   GameVerse — جدول مسیرها (hash router)
   ============================================================ */

import { addRoute } from '../core/router.js';
import * as home from './home.js';
import * as discovery from './discovery.js';
import * as gameDetail from './game-detail.js';
import * as play from './play.js';
import * as lobby from './lobby.js';
import * as room from './room.js';
import * as profile from './profile.js';
import * as friends from './friends.js';
import * as achievements from './achievements.js';
import * as leaderboard from './leaderboard.js';
import * as rewards from './rewards.js';
import * as notifications from './notifications.js';
import * as settings from './settings.js';
import * as admin from './admin.js';

export function registerAllRoutes() {
  addRoute('/', home.render);
  addRoute('/games', discovery.render);
  addRoute('/game/([\\w-]+)', gameDetail.render);
  addRoute('/play/([\\w-]+)', play.render);
  addRoute('/lobby', lobby.render);
  addRoute('/room/([A-Za-z0-9]+)', room.render);
  addRoute('/profile', profile.render);
  addRoute('/profile/([\\w-]+)', profile.render);
  addRoute('/friends', friends.render);
  addRoute('/achievements', achievements.render);
  addRoute('/leaderboard', leaderboard.render);
  addRoute('/rewards', rewards.render);
  addRoute('/notifications', notifications.render);
  addRoute('/settings', settings.render);
  addRoute('/admin', admin.render);
}
