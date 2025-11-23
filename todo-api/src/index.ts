import { serve } from "@hono/node-server";
import "dotenv/config";
import { Hono } from "hono";
import { cors } from "hono/cors"; // 追加
import { PrismaClient } from "./generated/prisma/client.js";

interface Todo {
  id: number;
  title: string;
  completed: boolean;
}

const todos: Todo[] = [];

const app = new Hono();
const prisma = new PrismaClient();

// 追加
app.use(
  cors({
    origin: "http://localhost:5173",
  })
);

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

app.get("/todos", async (c) => {
  const todos: Todo[] = await prisma.todo.findMany();
  return c.json(todos);
});

app.post("/todos", async (c) => {
  const { title } = await c.req.json();
  const todo = await prisma.todo.create({
    data: {
      title,
      completed: false,
    },
  });
  return c.json({ todo }, 201);
});

app.put("/todos/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const { completed } = await c.req.json();
  try {
    const todo = await prisma.todo.update({
      where: { id },
      data: { completed },
    });
    return c.json({ todo });
  } catch (error) {
    return c.json({ error }, 404);
  }
});

serve(
  {
    fetch: app.fetch,
    port: 3000,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  }
);
