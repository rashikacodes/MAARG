import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { connectDB } from "@/lib/connectDB";
import { User } from "@/models/user";

const loginSchema = z.object({
  email: z.string().trim().email("Please provide a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

function createJWT(payload: Record<string, unknown>) {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not defined");
  }

  return jwt.sign(payload, secret, {
    expiresIn: "1d",
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    if (!body) {
      return NextResponse.json(
        { message: "Request body is required" },
        { status: 400 }
      );
    }

    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          message: "Validation failed",
          errors: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;

    if (!process.env.MONGODB_URI) {
      return NextResponse.json(
        { message: "Database is not configured" },
        { status: 500 }
      );
    }

    await connectDB();

    const user = await User.findOne({ email: email.toLowerCase() }).lean();

    if (!user) {
      return NextResponse.json(
        { message: "Invalid email or password" },
        { status: 401 }
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return NextResponse.json(
        { message: "Invalid email or password" },
        { status: 401 }
      );
    }

    const token = createJWT({
      sub: String(user._id),
      email: user.email,
      name: user.name,
      roles: user.roles,
    });

    const response = NextResponse.json(
      {
        message: "Login successful",
        user: {
          _id: String(user._id),
          name: user.name,
          email: user.email,
          phone: user.phone,
          roles: user.roles,
          isActive: user.isActive,
          ...(user.driverProfile
            ? {
                driverProfile: {
                  ...user.driverProfile,
                  licenseExpiry: user.driverProfile.licenseExpiry.toISOString(),
                },
              }
            : {}),
          ...(user.adminProfile ? { adminProfile: user.adminProfile } : {}),
        },
      },
      { status: 200 }
    );

    response.cookies.set({
      name: "token",
      value: token,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24,
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);

    return NextResponse.json(
      {
        message: "Something went wrong while logging in",
      },
      { status: 500 }
    );
  }
}


