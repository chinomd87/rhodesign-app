#!/bin/bash

# cSpell:ignore Firestore RhodeSign
# Firebase Deployment Script for RhodeSign
# This script helps deploy Firebase services and rules

echo "🚀 RhodeSign Firebase Deployment Script"
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo -e "${RED}❌ Firebase CLI is not installed${NC}"
    echo -e "${YELLOW}📦 Installing Firebase CLI...${NC}"
    npm install -g firebase-tools
fi

echo -e "${GREEN}✅ Firebase CLI is available${NC}"

# Check if user is logged in
if ! firebase projects:list &> /dev/null; then
    echo -e "${YELLOW}🔐 Please login to Firebase...${NC}"
    firebase login
fi

echo -e "${GREEN}✅ Firebase authentication successful${NC}"

# Verify project exists
echo -e "${BLUE}🔍 Checking Firebase project...${NC}"
firebase use signet-e-signature

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to set Firebase project${NC}"
    echo -e "${YELLOW}Please ensure the 'signet-e-signature' project exists and you have access${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Using Firebase project: signet-e-signature${NC}"

# Deploy Firestore rules
echo -e "${BLUE}📋 Deploying Firestore rules...${NC}"
firebase deploy --only firestore:rules

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Firestore rules deployed successfully${NC}"
else
    echo -e "${RED}❌ Failed to deploy Firestore rules${NC}"
fi

# Deploy Firestore indexes
echo -e "${BLUE}🗂️  Deploying Firestore indexes...${NC}"
firebase deploy --only firestore:indexes

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Firestore indexes deployed successfully${NC}"
else
    echo -e "${RED}❌ Failed to deploy Firestore indexes${NC}"
fi

# Deploy Storage rules
echo -e "${BLUE}📁 Deploying Storage rules...${NC}"
firebase deploy --only storage

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Storage rules deployed successfully${NC}"
else
    echo -e "${RED}❌ Failed to deploy Storage rules${NC}"
fi

# Optional: Deploy hosting (if enabled)
read -p "$(echo -e ${YELLOW}📡 Do you want to deploy hosting? [y/N]: ${NC})" deploy_hosting

if [[ $deploy_hosting =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}🌐 Building application...${NC}"
    npm run build
    
    if [ $? -eq 0 ]; then
        echo -e "${BLUE}🚀 Deploying to Firebase Hosting...${NC}"
        firebase deploy --only hosting
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ Application deployed to Firebase Hosting${NC}"
            echo -e "${BLUE}🌐 Your app is live at: https://signet-e-signature.web.app${NC}"
        else
            echo -e "${RED}❌ Failed to deploy hosting${NC}"
        fi
    else
        echo -e "${RED}❌ Build failed${NC}"
    fi
fi

echo ""
echo -e "${GREEN}🎉 Firebase deployment completed!${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo -e "${YELLOW}1. Make sure Firestore Database is enabled in Firebase Console${NC}"
echo -e "${YELLOW}2. Make sure Firebase Storage is enabled in Firebase Console${NC}"
echo -e "${YELLOW}3. Run 'npm run dev' to start development server${NC}"
echo -e "${YELLOW}4. Test the Firebase connection using the app dashboard${NC}"
echo ""
echo -e "${BLUE}Firebase Console: https://console.firebase.google.com/project/signet-e-signature${NC}"
