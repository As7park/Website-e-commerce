#!/bin/bash

# Script pour nettoyer les fichiers Zone.Identifier créés par Windows
echo "Nettoyage des fichiers Zone.Identifier..."

# Trouver et supprimer tous les fichiers Zone.Identifier
find . -name "*:Zone.Identifier" -type f -delete

echo "Nettoyage terminé !"
