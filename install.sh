#!/bin/sh
set -e

NAMESPACE=gestionale

echo "================================================="
echo " Installazione Gestionale Famiglia su Kubernetes"
echo "================================================="
echo ""

# Verifica prerequisiti
if ! command -v kubectl >/dev/null 2>&1; then
  echo "ERRORE: kubectl non trovato. Installalo prima di continuare."
  exit 1
fi

# Verifica che i secret siano stati configurati
if [ ! -f k8s/postgres/secret.yaml ]; then
  echo "ERRORE: k8s/postgres/secret.yaml non trovato."
  echo "  cp k8s/postgres/secret.example.yaml k8s/postgres/secret.yaml"
  echo "  Poi modifica il file con la tua password PostgreSQL."
  exit 1
fi

if [ ! -f k8s/backend/secret.yaml ]; then
  echo "ERRORE: k8s/backend/secret.yaml non trovato."
  echo "  cp k8s/backend/secret.example.yaml k8s/backend/secret.yaml"
  echo "  Poi imposta la stessa password usata in postgres/secret.yaml."
  exit 1
fi

echo "Applico i manifest Kubernetes..."
echo ""

kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/postgres/pvc.yaml
kubectl apply -f k8s/postgres/secret.yaml
kubectl apply -f k8s/postgres/deployment.yaml
kubectl apply -f k8s/postgres/service.yaml
kubectl apply -f k8s/backend/secret.yaml
kubectl apply -f k8s/backend/deployment.yaml
kubectl apply -f k8s/backend/service.yaml
kubectl apply -f k8s/frontend/deployment.yaml
kubectl apply -f k8s/frontend/service.yaml

echo ""
echo "Deploy completato!"
echo ""
echo "Servizi nel namespace '${NAMESPACE}':"
kubectl get svc -n ${NAMESPACE}
echo ""
echo "Pod status (attendi qualche secondo per il readiness):"
kubectl get pods -n ${NAMESPACE}
echo ""
echo "Prossimo passo: configura Nginx Proxy Manager per puntare al"
echo "ClusterIP del servizio 'frontend' sulla porta 80."
