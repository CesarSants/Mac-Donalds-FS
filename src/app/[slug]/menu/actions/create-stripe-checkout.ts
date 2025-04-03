"use server";

import { ConsumptionMethod } from "@prisma/client";
import { headers } from "next/headers";
// import { parse } from "path";
import Stripe from "stripe";

import { db } from "@/lib/prisma";

import { CartProduct } from "../contexts/cart";
import { removeCpfPunctuation } from "../helpers/cpf";

interface CreateStripeCheckoutInput {
  products: CartProduct[];
  orderId: number;
  slug: string;
  consumptionMethod: ConsumptionMethod;
  cpf: string;
}

export const createStripeCheckout = async ({
  orderId,
  products,
  slug,
  consumptionMethod,
  cpf,
}: CreateStripeCheckoutInput) => {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("Missing Stripe secret key");
  }
  const origin = (await headers()).get("origin") as string;
  const productsWithPrices = await db.product.findMany({
    where: {
      id: {
        in: products.map((product) => product.id),
      },
    },
  });
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    // apiVersion: "2025-02-24.acacia",
    apiVersion: "2025-03-31.basil",
  });
  const searchParams = new URLSearchParams();
  searchParams.set("consumptionMethod", consumptionMethod);
  searchParams.set("cpf", removeCpfPunctuation(cpf));
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    success_url: `${origin}/${slug}/orders?${searchParams.toString()}`,
    cancel_url: `${origin}/${slug}/orders?${searchParams.toString()}`,
    metadata: {
      orderId,
    },
    line_items: products.map((product) => ({
      price_data: {
        currency: "brl",
        product_data: {
          name: product.name,
          images: [product.imageUrl],
        },
        unit_amount:
          // Math.round(productsWithPrices.find((p) => p.id === product.id)!.price * 100)
          productsWithPrices.find((p) => p.id === product.id)!.price * 100,
          // parseInt(String(product.price *100)),
      },
      quantity: product.quantity,
    })),
  });
  return { sessionId: session.id };
};

// stripe login

// $env:Path += ";C:\Users\CesarSantos\stripe\"

//stripe listen --forward-to http://localhost:3000/api/webhooks/stripe
