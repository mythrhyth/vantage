import { Request, Response } from 'express';
import { ingestionService } from '../services/ingestion/ingestion.service';
import { SourceConfigError, sourceAdapterManager } from '../services/ingestion/source-manager';
import { SourceConfig } from '../types/ingestion.types';
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

  async createSource(req: Request, res: Response) {
    try {
      const body = req.body || {};
      if (
        typeof body.name !== 'string' ||
        typeof body.domain !== 'string' ||
        typeof body.sourceType !== 'string' ||
        typeof body.feedUrl !== 'string'
      ) {
        return res.status(400).json({ error: { message: 'name, domain, sourceType, and feedUrl are required' } });
      }
      if (body.enabled !== undefined && typeof body.enabled !== 'boolean') {
        return res.status(400).json({ error: { message: 'enabled must be a boolean' } });
      }
      if (
        (body.fetchInterval !== undefined && typeof body.fetchInterval !== 'number') ||
        (body.maxItemsPerRun !== undefined && typeof body.maxItemsPerRun !== 'number')
      ) {
        return res.status(400).json({ error: { message: 'fetchInterval and maxItemsPerRun must be numbers' } });
      }

      const source = await sourceAdapterManager.createSource({
        name: body.name,
        domain: body.domain,
        sourceType: body.sourceType,
        feedUrl: body.feedUrl,
        enabled: body.enabled ?? true,
        fetchInterval: body.fetchInterval ?? 15,
        maxItemsPerRun: body.maxItemsPerRun ?? 20
      });
      return res.status(201).json(source);
    } catch (e) {
      if (e instanceof SourceConfigError) {
        return res.status(e.statusCode).json({ error: { message: e.message } });
      }
      const message = e instanceof Error ? e.message : 'Unable to create ingestion source';
      return res.status(500).json({ error: { message } });
    }
  }

  async toggleSource(req: Request, res: Response) {
    try {
      const { id } = req.params;
      if (typeof id !== 'string') {
        return res.status(400).json({ error: { message: 'Source ID is required' } });
      }
      const { enabled } = req.body;
      if (typeof enabled !== 'boolean') {
        return res.status(400).json({ error: { message: 'enabled must be a boolean' } });
      }
      const updated = await sourceAdapterManager.toggleSource(id, enabled);
      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ error: { message: e.message } });
    }
  }

  async updateSource(req: Request, res: Response) {
    try {
      const { id } = req.params;
      if (typeof id !== 'string') {
        return res.status(400).json({ error: { message: 'Source ID is required' } });
      }
      const body = req.body || {};
      const updates: Partial<SourceConfig> = {};
      for (const field of ['name', 'domain', 'sourceType', 'feedUrl'] as const) {
        if (body[field] !== undefined) {
          if (typeof body[field] !== 'string') {
            return res.status(400).json({ error: { message: `${field} must be a string` } });
          }
          updates[field] = body[field];
        }
      }
      if (body.enabled !== undefined) {
        if (typeof body.enabled !== 'boolean') {
          return res.status(400).json({ error: { message: 'enabled must be a boolean' } });
        }
        updates.enabled = body.enabled;
      }
      if (body.fetchInterval !== undefined) {
        if (typeof body.fetchInterval !== 'number') {
          return res.status(400).json({ error: { message: 'fetchInterval must be a number' } });
        }
        updates.fetchInterval = body.fetchInterval;
      }
      if (body.maxItemsPerRun !== undefined) {
        if (typeof body.maxItemsPerRun !== 'number') {
          return res.status(400).json({ error: { message: 'maxItemsPerRun must be a number' } });
        }
        updates.maxItemsPerRun = body.maxItemsPerRun;
      }
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: { message: 'At least one source field must be provided' } });
      }
      const updated = await sourceAdapterManager.updateSource(id, updates);
      res.json(updated);
    } catch (e) {
      if (e instanceof SourceConfigError) {
        return res.status(e.statusCode).json({ error: { message: e.message } });
      }
      const message = e instanceof Error ? e.message : 'Unable to update ingestion source';
      res.status(500).json({ error: { message } });
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
