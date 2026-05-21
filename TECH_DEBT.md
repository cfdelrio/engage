# Technical Debt

Lista de mejoras y refactorings identificados para implementar después.

## CI/CD & DevOps

### GitHub Actions Path-Based Deploy (Medium Priority)

**Estado:** Identificado, no implementado
**Razón para esperar:** Deploy actual funciona bien; esto es optimización para paralelizar jobs

Reemplazar el deploy secuencial actual con jobs paralelos que se disparan solo si sus paths cambiaron:

```yaml
name: Deploy to EC2

on:
  push:
    branches: [main]

jobs:
  detect-changes:
    runs-on: ubuntu-latest
    outputs:
      api: ${{ steps.changes.outputs.api }}
      web: ${{ steps.changes.outputs.web }}
      worker: ${{ steps.changes.outputs.worker }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - id: changes
        run: |
          git diff origin/main~1 origin/main --name-only > /tmp/changes.txt
          cat /tmp/changes.txt
          echo "api=$([[ $(cat /tmp/changes.txt) =~ apps/api|packages ]] && echo true || echo false)" >> $GITHUB_OUTPUT
          echo "web=$([[ $(cat /tmp/changes.txt) =~ apps/web|packages/core ]] && echo true || echo false)" >> $GITHUB_OUTPUT
          echo "worker=$([[ $(cat /tmp/changes.txt) =~ apps/worker|packages ]] && echo true || echo false)" >> $GITHUB_OUTPUT

  deploy:
    needs: detect-changes
    runs-on: ubuntu-latest
    env:
      DEPLOY_API: ${{ needs.detect-changes.outputs.api }}
      DEPLOY_WEB: ${{ needs.detect-changes.outputs.web }}
      DEPLOY_WORKER: ${{ needs.detect-changes.outputs.worker }}
    steps:
      - uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ec2-user
          key: ${{ secrets.EC2_SSH_KEY }}
          script: |
            cd /home/ec2-user/engage
            git pull origin main
            pnpm --filter @engage/database db:generate
            pnpm --filter @engage/core build
            pnpm --filter @engage/ai build
            [ "$DEPLOY_API" = "true" ] && pnpm --filter @engage/api build && sudo systemctl restart orkestai-api
            [ "$DEPLOY_WEB" = "true" ] && {
              pnpm --filter @engage/web build
              cp -r apps/web/.next/static apps/web/.next/standalone/apps/web/.next/static
              sudo systemctl restart orkestai-web
            }
            [ "$DEPLOY_WORKER" = "true" ] && pnpm --filter @engage/worker build && sudo systemctl restart orkestai-worker
```

**Beneficios:**

- Jobs paralelos en lugar de secuencial
- Output explícito de qué fue deployado
- Base sólida para agregar more jobs (smoke tests, E2E, etc.)

---

## Features Pendientes

- [ ] Voice Campaigns (Twilio integration)
- [ ] Analytics V2 (dashboard mejorado)
- [ ] WhatsApp campaign management
- [ ] User preference center (página pública)

---

## Notas

- Deploy actual (Opción A) funciona perfectamente en producción
- Opción B mejora observabilidad y permite agregar más jobs en el futuro
- Implementar cuando haya necesidad de más visibilidad en CI/CD
