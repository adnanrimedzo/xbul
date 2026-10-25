import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from './auth-schema';

export const profiles = pgTable('profiles', {
  userId: text('user_id').primaryKey().references(() => user.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  displayName: text('display_name').notNull(),
  handle: text('handle').unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
