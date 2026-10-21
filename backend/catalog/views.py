from rest_framework import permissions, viewsets
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser

from accounts.permissions import IsAdmin

from .models import Product
from .serializers import ProductSerializer


class ProductViewSet(viewsets.ModelViewSet):
    """Admin-only catalog management (create/edit/delete) — call with a JWT
    access token, same as the rest of this API. No UI; API-only by design."""

    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    parser_classes = [MultiPartParser, FormParser, JSONParser]


class PublicProductViewSet(viewsets.ReadOnlyModelViewSet):
    """Open, read-only catalog feed — no login required. Meant for other
    projects to pull Al Merak's product list (see /api/public/products/).
    CORS_ALLOWED_ORIGINS controls which sites may call this from a browser;
    server-to-server calls aren't restricted by CORS at all."""

    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
