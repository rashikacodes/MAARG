
import mongoose, { Document, Schema } from "mongoose";

export type RouteStatus =
  | "ACTIVE"
  | "SUPERSEDED"
  | "BLOCKED"
  | "COMPLETED";

export interface IRoute extends Document {
  routeId: string;

  missionId: string;
  truckNo: string;

  routeVersion: number;
  alternativeRank: number;

  geometry: {
    type: "LineString";
    coordinates: [number, number][];
  };

  distanceMeters: number;
  durationSeconds: number;

  riskScore: number;
  riskBand: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";

  status: RouteStatus;

  triggeredByIncidentId?: string;
}

const routeSchema = new Schema<IRoute>(
  {
    routeId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    missionId: {
      type: String,
      required: true,
      index: true,
    },

    truckNo: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    routeVersion: {
      type: Number,
      required: true,
      default: 1,
    },

    alternativeRank: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
      max: 3,
    },

    geometry: {
      type: {
        type: String,
        enum: ["LineString"],
        required: true,
      },

      coordinates: {
        type: [[Number]],
        required: true,
      },
    },

    distanceMeters: {
      type: Number,
      required: true,
    },

    durationSeconds: {
      type: Number,
      required: true,
    },

    riskScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },

    riskBand: {
      type: String,
      enum: ["LOW", "MODERATE", "HIGH", "CRITICAL"],
      default: "LOW",
    },

    status: {
      type: String,
      enum: [
        "ACTIVE",
        "SUPERSEDED",
        "BLOCKED",
        "COMPLETED",
      ],
      default: "ACTIVE",
    },

    triggeredByIncidentId: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

routeSchema.index({
  geometry: "2dsphere",
});

routeSchema.index({
  missionId: 1,
  routeVersion: 1,
});

export const Route =
  mongoose.models.Route ||
  mongoose.model<IRoute>("Route", routeSchema);