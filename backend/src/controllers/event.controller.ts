import { Request, Response } from 'express';
import { eventService } from '../services/events/event.service';
import { nlpService } from '../providers/nlp/nlp.service';

export class EventController {
  async listEvents(req: Request, res: Response) {
    try {
      const { category, sentiment, impact, horizon, portfolioId, source, freshness } = req.query;
      
      const filters: any = {};
      if (category) filters.category = String(category);
      if (horizon) filters.horizon = String(horizon);
      if (source) filters.source = String(source);
      if (freshness) filters.freshness = String(freshness);
      if (portfolioId) filters.portfolioId = String(portfolioId);
      if (sentiment !== undefined) filters.sentiment = parseFloat(String(sentiment));
      if (impact !== undefined) filters.impact = parseFloat(String(impact));

      const events = await eventService.listEvents(filters);
      res.json(events);
    } catch (e: any) {
      res.status(500).json({ error: { message: e.message } });
    }
  }

  async getEventById(req: Request, res: Response) {
    try {
      const event = await eventService.getEventById(req.params.id);
      if (!event) {
        return res.status(404).json({ error: { message: 'Event not found' } });
      }
      res.json(event);
    } catch (e: any) {
      res.status(500).json({ error: { message: e.message } });
    }
  }

  async analyzeEvent(req: Request, res: Response) {
    try {
      const { text, source, timestamp } = req.body;
      if (!text || text.trim() === '') {
        return res.status(400).json({ error: { message: 'Text is required for analysis' } });
      }

      const title = text.substring(0, 60) + (text.length > 60 ? '...' : '');
      const event = await nlpService.analyzeAndPersist(
        { title, source: source || 'Manual Input', publishedAt: timestamp },
        text
      );

      res.status(201).json(event);
    } catch (e: any) {
      if (e.name === 'NlpValidationException') {
        return res.status(400).json({ error: { message: e.message } });
      }
      res.status(500).json({ error: { message: e.message } });
    }
  }
}

export const eventController = new EventController();
