import { Request, Response } from 'express';
import {
  createApartment,
  deleteApartment,
  getApartmentById,
  getApartments,
  getUniqueCities,
  getUniqueTypes,
  updateApartment,
} from '../services/apartments.service';
import * as CONS from '../config/constants'
import { EmbeddingController } from './embedding.controller';
import { Apartment } from '../models/Apartment.model';
import axios from 'axios';

let ec: EmbeddingController | null = null;
function getEmbeddingController(): EmbeddingController {
  if (!ec) {
    ec = new EmbeddingController();
  }
  return ec;
}


export class ApartmentsController {

  async handleGetApartments(req: Request, res: Response) {
    try {
      const {
        search,
        city,
        type,
        rooms,
        minPrice,
        maxPrice,
        page,
        limit,
        premium
      } = req.query;

      const pageNumber = page ? parseInt(page as string, 10) : 1;
      const limitNumber = limit ? parseInt(limit as string, 10) : undefined;

      const minPriceNumber = minPrice ? parseFloat(minPrice as string) : undefined;
      const maxPriceNumber = maxPrice ? parseFloat(maxPrice as string) : undefined;

      if (Number.isNaN(pageNumber) || pageNumber < 1) {
        return res.status(400).json({ message: CONS.MSG_INVALID_PAGE });
      }

      if (
        (minPriceNumber !== undefined && Number.isNaN(minPriceNumber)) ||
        (maxPriceNumber !== undefined && Number.isNaN(maxPriceNumber))
      ) {
        return res.status(400).json({ message: CONS.MSG_INVALID_PRICE });
      }

      const filters = {
        search: (search as string) || undefined,
        city: (city as string) || undefined,
        type: (type as string) || undefined,
        rooms: (rooms as string) || undefined,
        minPrice: minPriceNumber,
        maxPrice: maxPriceNumber,
        page: pageNumber,
        limit: limitNumber,
        premium: premium === 'true' ? true : undefined,
      };

      const data = await getApartments(filters);

      return res.json(data);
    } catch (error) {
      console.error(CONS.MSG_APARTMENTS_FETCH_ERROR, error);
      return res.status(500).json({ message: CONS.MSG_APARTMENTS_FETCH_ERROR, });
    }
  }

  async handleGetPremiumProperties(req: Request, res: Response) {
    try {
      const data = await Apartment.find({ premium: true, active: { $ne: false } }).limit(5)
      return res.json(data)
    } catch (error) {
      console.error(CONS.MSG_APARTMENTS_FETCH_ERROR, error);
      return res.status(500).json({ message: CONS.MSG_APARTMENTS_FETCH_ERROR, });
    }
  }

  async handleGetApartmentById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({ message: CONS.MSG_MISSING_APARTMENT_ID });
      }

      const apartment = await getApartmentById(id);

      if (!apartment) {
        return res.status(404).json({ message: CONS.MSG_APARTMENT_NOT_FOUND });
      }

      return res.json(apartment);
    } catch (error) {
      console.error(CONS.MSG_APARTMENT_FETCH_BY_ID_ERROR, error);
      return res.status(500).json({ message: CONS.MSG_APARTMENT_FETCH_BY_ID_ERROR });
    }
  }

  async handleCreateApartment(req: Request, res: Response) {
    try {
      const apartmentData = req.body;

      if (!apartmentData || !apartmentData.city || !apartmentData.price) {
        return res.status(400).json({ message: CONS.MSG_MISSING_APARTMENT_FIELDS });
      }
      const embedding = await getEmbeddingController().embedProperty(apartmentData)
      const dataWithEmbedding = { ...apartmentData, embedding }
      const created = await createApartment(dataWithEmbedding);
      return res.status(201).json(created);
    } catch (error) {
      console.error(CONS.MSG_CREATE_APARTMENT_ERROR, error);
      return res.status(500).json({ message: CONS.MSG_CREATE_APARTMENT_ERROR });
    }
  }

  async handleUpdateApartment(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const apartmentData = req.body;

      const updated = await updateApartment(id, apartmentData);

      if (!updated) {
        return res.status(404).json({ message: CONS.MSG_APARTMENT_NOT_FOUND });
      }

      return res.json(updated);
    } catch (error) {
      console.error(CONS.MSG_UPDATE_APARTMENT_ERROR, error);
      return res.status(500).json({ message: CONS.MSG_UPDATE_APARTMENT_FAILED });
    }
  }

  async handleDeleteApartment(req: Request, res: Response) {
    try {
      const { id } = req.params;

      await deleteApartment(id);

      return res.status(204).send();
    } catch (error) {
      console.error(CONS.MSG_DELETE_APARTMENT_ERROR, error);
      return res.status(500).json({ message: CONS.MSG_DELETE_APARTMENT_FAILED });
    }
  }

  async handleGetCities(req: Request, res: Response) {
    try {
      const cities = await getUniqueCities();
      return res.json(cities);
    } catch (error) {
      console.error(CONS.MSG_FETCH_CITIES_ERROR, error);
      return res.status(500).json({ message: CONS.MSG_FETCH_CITIES_ERROR });
    }
  }

  async handleGetTypes(req: Request, res: Response) {
    try {
      const types = await getUniqueTypes();
      return res.json(types);
    } catch (error) {
      console.error(CONS.MSG_FETCH_TYPES_FAILED, error);
      return res.status(500).json({ message: CONS.MSG_FETCH_TYPES_FAILED });
    }
  }

  async handleGetApartmentsByAI(req: Request, res: Response) {
    const { message } = req.body
    try {
      const llmResponse = await getEmbeddingController().talkWithTheAI(message)

      if (!(llmResponse.is_search)) {
        return res.json({ is_search: false, reply: llmResponse.reply })
      }


      const filters = llmResponse.filters
      let filter = {} as any
      if (filters) {
        if (filters.min_price) filter.price = { $gte: Number(filters.min_price) };
        if (filters.max_price) filter.price = { $lte: Number(filters.max_price) };

      }
      const city = filters?.city || null

      const queryEmbedding = await getEmbeddingController().embedQuery(message)
      const results = await Apartment.aggregate([
        {
          $vectorSearch: {
            index: "vector_index",
            path: "embedding",
            queryVector: queryEmbedding,
            numCandidates: 100,
            limit: 5,
            filter
          }
        }
      ])
      const resultsFilterdByCity = city ? results.filter((r) => String(r.city).includes(city)) : results
      return res.json({ is_search: true, results: resultsFilterdByCity, reply: llmResponse.reply })
    } catch (error) {
      console.log("error in handleGetApartmentsByAI", error)
    }
  }

  async talkWithAgent(req: Request, res: Response) {
    const { message } = req.body;
    const url = process.env.AGENT_URL || ''
    try {
      const resp = await axios.get(url, {
        params: { chatInput: message, sessionId: req.sessionID }
      });


      let rawOutput;

      if (Array.isArray(resp.data) && resp.data.length > 0) {
        rawOutput = resp.data[0].output !== undefined ? resp.data[0].output : resp.data[0];
      } else if (resp.data && typeof resp.data === 'object') {
        rawOutput = resp.data.output !== undefined ? resp.data.output : resp.data;
      }

      let finalData: any = {};

      if (typeof rawOutput === 'string') {
        const trimmed = rawOutput.trim();
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
          try {
            finalData = JSON.parse(trimmed);
          } catch (e) {
            finalData = { message: rawOutput };
          }
        } else {
          finalData = { message: rawOutput };
        }
      } else if (typeof rawOutput === 'object' && rawOutput !== null) {
        finalData = rawOutput;
      }

      const replyText = finalData.message || (typeof finalData === 'string' ? finalData : null);

      if (!replyText) {
        return res.json({ is_search: false, reply: "I'm having trouble connecting to the schedule. Please try again." });
      }

      return res.json({ is_search: false, reply: replyText });

    } catch (error) {
      console.error("Error checking apartment existence:", error);
      return res.status(500).json({ message: "Error processing request" });
    }
  }
}

