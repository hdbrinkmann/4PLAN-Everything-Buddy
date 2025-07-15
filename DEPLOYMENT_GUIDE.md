# Deployment Guide: 4PLAN Everything Buddy

This guide provides instructions for deploying the 4PLAN Everything Buddy application to a new machine using Docker and GitHub.

## Prerequisites

1.  **Docker:** Ensure Docker is installed on both your development and deployment machines.
2.  **Git:** Ensure Git is installed on both machines.
3.  **Git LFS:** Ensure Git LFS is installed on both machines (`brew install git-lfs`).
4.  **GitHub Account:** You need a GitHub account.
5.  **GitHub Personal Access Token (PAT):** You need a PAT with `read:packages` and `write:packages` scopes to interact with the GitHub Container Registry. You can create one [here](https://github.com/settings/tokens?type=beta).

---

## On Your Development Machine

These steps are for building the Docker image and pushing it to the GitHub Container Registry.

### 1. Build the Docker Image

Build the image using the standard `docker-compose.yml` file. This ensures all your data from `Documents/` and `vector_store/` is included in the image.

```bash
docker-compose build
```

### 2. Log in to GitHub Container Registry

Log in to `ghcr.io` using your GitHub username and your Personal Access Token (PAT).

```bash
export CR_PAT=YOUR_PERSONAL_ACCESS_TOKEN
echo $CR_PAT | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

### 3. Tag and Push the Image

Tag the locally built image with the correct name for the GitHub Container Registry and then push it.

```bash
# Tag the image
docker tag 4plan-everything-buddy-app ghcr.io/hdbrinkmann/4plan-everything-buddy:latest

# Push the image
docker push ghcr.io/hdbrinkmann/4plan-everything-buddy:latest
```

---

## On a New (Deployment) Machine

These steps are for setting up and running the application on a new computer.

### 1. Clone the Repository

Clone your project's source code from GitHub. Git LFS will automatically download the large files.

```bash
git clone https://github.com/hdbrinkmann/4PLAN-Everything-Buddy.git
cd 4PLAN-Everything-Buddy
```

### 2. Set Up Required Files

The application requires a few files to be present in the project directory to run correctly. You will need to copy these from your development machine or create them:

*   `ssl/`: The directory containing your `cert.pem` and `key.pem` files for HTTPS.
*   `.env`: The environment file containing secrets like `VITE_TENANT_ID` and `VITE_CLIENT_ID`.
*   `favorites.db`: The application's database file.
*   `admins.json`: Configuration file for administrators.
*   `features.json`: Configuration file for features.
*   `knowledge_fields.json`: Configuration file for knowledge fields.

### 3. Log in to GitHub Container Registry

Just like on the development machine, you need to log in to pull the image.

```bash
export CR_PAT=YOUR_PERSONAL_ACCESS_TOKEN
echo $CR_PAT | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

### 4. Pull the Docker Image

Pull the application image from the registry.

```bash
docker pull ghcr.io/hdbrinkmann/4plan-everything-buddy:latest
```

### 5. Run the Application

Start the application using the `docker-compose.prod.yml` file. This file is specifically configured to use the pre-built image and the local files you set up in step 2.

```bash
docker-compose -f docker-compose.prod.yml up -d
```

Your application should now be running on the new machine.
