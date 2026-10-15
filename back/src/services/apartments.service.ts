import { Apartment } from '../models/Apartment.model';
import { ApartmentDocument } from '../types/models.types';
import { ApartmentFilters } from '../types/service.types';

export async function getApartments(filters: ApartmentFilters) {
  const { search, city, type, rooms, minPrice, maxPrice,premium, dealType, page = 1, limit = 10 } = filters;

  const query: any = { active: { $ne: false } };

  if (search) {
    const searchRegex = { $regex: search, $options: 'i' };
    query.$or = [
      { street: searchRegex },
      { city: searchRegex },
      { info: searchRegex }
    ];
  }

  if (city) query.city = city;
  if (type) query.type = type;
  if (rooms) query.rooms = rooms;
  if(premium !== undefined) query.premium = premium;
  if (dealType) query.dealType = dealType;

  if (minPrice || maxPrice) {
    query.price = {};
    if (minPrice) query.price.$gte = Number(minPrice);
    if (maxPrice) query.price.$lte = Number(maxPrice);
  }

  const skip = (page - 1) * limit;

  const results = await Apartment.find(query)
    .select('-embedding')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const totalResults = await Apartment.countDocuments(query);
  return {
    results,
    totalResults,
    currentPage: page,
    totalPages: Math.ceil(totalResults / limit),
  };
}

export async function getApartmentById(id: string) {
  return Apartment.findById(id).select('-embedding').lean();
}

export async function createApartment(payload: Partial<ApartmentDocument>) {
  const apartment = new Apartment(payload);
  await apartment.save();
  return apartment.toObject();
}

export async function updateApartment(id: string, payload: Partial<ApartmentDocument>) {
  const updated = await Apartment.findByIdAndUpdate(id, payload, { new: true, runValidators: true }).lean();
  return updated;
}

export async function deleteApartment(id: string) {
  await Apartment.findByIdAndDelete(id);
}

export async function getUniqueCities() {
  const cities = await Apartment.distinct('city');
  return cities.filter(Boolean).sort();
}

export async function getUniqueTypes() {
  const types = await Apartment.distinct('type');
  return types.filter(Boolean).sort();
}
