import fp from "fastify-plugin"
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify"

/**
 * Error handler global — mengubah error menjadi envelope `{error:{code,message,details}}`.
 * Menangani: validasi (400), duplikat MySQL (ER_DUP_ENTRY -> 409), not found, dll.
 */
export const errorHandlerPlugin = fp(async (app: FastifyInstance) => {
  await app.register(import("@fastify/sensible"))

  app.setErrorHandler((error: any, request: FastifyRequest, reply: FastifyReply) => {
    // Validasi schema (fastify-type-provider-zod)
    if (error.validation || error.name === "ZodError") {
      return reply.code(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: error.message ?? "Data tidak valid",
          details: error.validation ?? error.issues,
        },
      })
    }

    // Duplikat (unique constraint)
    if (error.code === "ER_DUP_ENTRY") {
      return reply.code(409).send({
        error: { code: "DUPLICATE", message: "Data sudah terdaftar (kode/nama/email duplikat)" },
      })
    }

    // Tidak ditemukan
    if (error.code === "P2025" || /not found|doesn't exist/i.test(error.message ?? "")) {
      return reply.code(404).send({
        error: { code: "NOT_FOUND", message: "Resource tidak ditemukan" },
      })
    }

    if (error.statusCode && error.statusCode < 500) {
      return reply.code(error.statusCode).send({
        error: { code: error.code ?? "BAD_REQUEST", message: error.message },
      })
    }

    app.log.error(error)
    return reply.code(500).send({
      error: { code: "INTERNAL_ERROR", message: "Terjadi kesalahan internal server" },
    })
  })
})
