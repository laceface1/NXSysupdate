import webhook from 'webhook-discord';
import { packMessage, themeMessage } from '../util/webhookMessages';
const Hook = new webhook.Webhook(process.env.WEBHOOK_URL);
