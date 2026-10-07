import { Request, Response } from 'express';
import { ingestionService } from '../services/ingestion/ingestion.service';
import { sourceAdapterManager } from '../services/ingestion/source-manager';
import { prisma } from '../db';

export class IngestionController {
  async runIngestion(req: Request, res: Response) {
    try {
      const { window } = req.body || {};
      const result = await ingestionService.runIngestion(window);
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: { message: e.message } });
    }
  }

  async getSources(req: Request, res: Response) {
    try {
      const sources = await sourceAdapterManager.initializeSources();
      res.json(sources);
    } catch (e: any) {
      res.status(500).json({ error: { message: e.message } });
    }
  }

  async toggleSource(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { enabled } = req.body;
      const updated = await sourceAdapterManager.toggleSource(id, enabled);
      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ error: { message: e.message } });
    }
  }

  async updateSource(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const updated = await sourceAdapterManager.updateSource(id, req.body);
      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ error: { message: e.message } });
    }
  }

  async getSettings(req: Request, res: Response) {
    try {
      const settings = await prisma.ingestionSystemSettings.findFirst() || 
        await prisma.ingestionSystemSettings.create({ data: { id: 'default' } });
      res.json(settings);
    } catch (e: any) {
      res.status(500).json({ error: { message: e.message } });
    }
  }

  async updateSettings(req: Request, res: Response) {
    try {
      const updated = await prisma.ingestionSystemSettings.update({
        where: { id: 'default' },
        data: req.body
      });
      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ error: { message: e.message } });
    }
  }
}

export const ingestionController = new IngestionController();
