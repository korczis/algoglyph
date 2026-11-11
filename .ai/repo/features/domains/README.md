---
schema: context/v1
id: ai.repo.features.domains
kind: context
title: Product domains
description: The product domains features are filed under, one file per domain (schema domain/v1); a feature names its domain and the domain never lists its features.
status: active
scope: subtree
providers: ["*"]
audience: [human, agent]
composition: extend
order: 100
---

# Product domains

A domain is a part of the product a visitor recognises. Each file here is one domain
(`schema: domain/v1`, contract `share/schemas/majordomus/domain/domain.v1.schema.json`);
the file name is the `id`. Which features a domain holds is each feature's own `domain`,
and every reverse listing is derived.
