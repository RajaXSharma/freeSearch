import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const chats = await db.chat.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        messages: {
          take: 1,
          orderBy: { createdAt: "desc" },
        },
      },
    });

    return NextResponse.json(chats);
  } catch (error) {
    console.error("Failed to fetch chats:", error);
    return NextResponse.json(
      { error: "Failed to fetch chats" },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const chat = await db.chat.create({
      data: {
        title: "New Chat",
      },
    });

    return NextResponse.json(chat);
  } catch (error) {
    console.error("Failed to create chat:", error);
    return NextResponse.json(
      { error: "Failed to create chat" },
      { status: 500 }
    );
  }
}
