import { Schema, model, models } from 'mongoose';

const proxySchema = new Schema({
  user_id: {
    type: String,
    required: true,
    index: true,
    ref: 'User'
  },
  ip: {
    type: String,
    required: true
  },
  port: {
    type: String,
    required: true
  },
  username: {
    type: String,
    required: true
  },
  password: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['success'],
    required: true,
    index: true
  }
});

// Add compound index for efficient queries
proxySchema.index({ user_id: 1, status: 1 });

export const Proxy = models.Proxy || model('Proxy', proxySchema);