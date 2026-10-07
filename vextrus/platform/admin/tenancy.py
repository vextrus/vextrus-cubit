"""The admin under row-level security (ticket 02; ADR 0034; docs/data-model.md §3.0).

The admin runs as `vextrus_app`, under the same policies as any request. Vextrus's staff pick the
Developer they act in from `staff_developers` (each pick an act that Developer's MD sees); with none
picked they see no tenant's rows. They may create a Developer (on its Market, with its home region;
the new id becomes the tenant in the same transaction) and that Developer's first MD invitation, and
nothing else: never a Membership, and never one of their own. Only Developer and Membership are
registered in M0; operators reach other data only through the beta's audited path.

The admin's LogEntry writes are switched off (`vextrus_app` has no rights on `django_admin_log`), so
the index's "Recent actions" and each object's history are gone. A module that registers a model in
the admin later subclasses `TenantModelAdmin`.
"""

import uuid
from functools import cache
from typing import Any, ClassVar

from django import forms
from django.contrib import admin, messages
from django.db.models import Model, QuerySet
from django.forms import ModelForm
from django.http import Http404, HttpRequest, HttpResponse, HttpResponseRedirect
from django.template import engines
from django.template.backends.django import Template
from django.template.response import TemplateResponse
from django.urls import URLPattern, path, reverse
from django.utils.functional import SimpleLazyObject
from django.utils.translation import get_language, gettext_lazy
from django.utils.translation import gettext as _
from django.views.decorators.http import require_POST

from vextrus.platform.models import Developer, Market, Membership
from vextrus.platform.services import invitations, tenancy

INDEX = """{% extends "admin/index.html" %}{% block sidebar %}{% endblock %}"""

PICK = """{% extends "admin/base_site.html" %}{% load i18n %}
{% block content %}<div id="content-main">
<p>{% translate "Pick the Developer to act in. The Developer's MD sees each pick." %}</p>
<table>
{% for developer in developers %}
<tr><th scope="row">{{ developer.name }}{% if developer.id == acting %}
  ({% translate "acting in it" %}){% endif %}</th>
<td><form method="post" action="{{ developer.url }}">{% csrf_token %}
  <input type="submit" value="{% translate 'Act in this Developer' %}"></form></td></tr>
{% empty %}
<tr><td>{% translate "There is no Developer yet." %}</td></tr>
{% endfor %}
</table>
<p><a class="addlink" href="{{ add_url }}">{% translate "Create a Developer" %}</a></p>
</div>{% endblock %}"""


@cache
def _template(source: str) -> Template:
    template = engines["django"].from_string(source)
    assert isinstance(template, Template)
    return template


# The index without "Recent actions" (it reads django_admin_log).
admin.site.index_template = SimpleLazyObject(lambda: _template(INDEX))  # type: ignore[assignment]
# Only Developer and Membership are registered in M0: the admin shows no other model.
for registered in [model for model in admin.site._registry if model not in (Developer, Membership)]:
    admin.site.unregister(registered)


class TenantModelAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    """No LogEntry is written, and no history is read; nothing is deleted from the admin."""

    def log_addition(self, request: HttpRequest, obj: Any, message: Any) -> None:  # type: ignore[override]
        return None

    def log_change(self, request: HttpRequest, obj: Any, message: Any) -> None:  # type: ignore[override]
        return None

    def log_deletions(self, request: HttpRequest, queryset: Any) -> None:  # type: ignore[override]
        return None

    def history_view(self, *args: Any, **kwargs: Any) -> HttpResponse:
        raise Http404

    def has_delete_permission(self, request: HttpRequest, obj: Model | None = None) -> bool:
        return False


REGION_NAMES = {"asia-south1": "Mumbai"}
"""A stored home region's place, by its cell id (a cell's word, not a Market's); an id not here
is shown as stored."""


def market_name(market: Market) -> str:
    """The Market's name in the language shown, else in English, else its code."""
    labels = market.labels if isinstance(market.labels, dict) else {}
    return str(labels.get(get_language() or "") or labels.get("en") or market.code)


def region_name(home_region: str) -> str:
    return REGION_NAMES.get(home_region, home_region)


class MarketChoiceField(forms.ModelChoiceField):  # type: ignore[type-arg]
    def label_from_instance(self, obj: Market) -> str:
        return market_name(obj)


class DeveloperForm(forms.ModelForm):  # type: ignore[type-arg]
    home_region = forms.CharField(
        required=False,
        max_length=32,
        label=gettext_lazy("Home region"),
        help_text=gettext_lazy("Leave it empty for the Market's default."),
    )

    class Meta:
        model = Developer
        fields = ("name", "market", "home_region")
        field_classes: ClassVar = {"market": MarketChoiceField}


@admin.register(Developer)
class DeveloperAdmin(TenantModelAdmin):
    """The list is the pick; a Developer's page shows only the one staff act in, read-only (a
    rename would be a domain act with no event: M0 has none)."""

    form = DeveloperForm

    def has_change_permission(self, request: HttpRequest, obj: Model | None = None) -> bool:
        return False

    def get_fields(self, request: HttpRequest, obj: Model | None = None) -> Any:
        return ["name", "market", "home_region"] if obj is None else ["name"]

    def get_readonly_fields(self, request: HttpRequest, obj: Model | None = None) -> list[str]:
        return [] if obj is None else ["name", "market_in_words", "home_region_in_words", "created_at"]

    @admin.display(description=gettext_lazy("Market"))
    def market_in_words(self, obj: Developer) -> str:
        return market_name(obj.market)

    @admin.display(description=gettext_lazy("Home region"))
    def home_region_in_words(self, obj: Developer) -> str:
        return region_name(obj.home_region)

    def get_fieldsets(self, request: HttpRequest, obj: Model | None = None) -> Any:
        if obj is not None:
            return [(None, {"fields": self.get_readonly_fields(request, obj)})]
        return [(None, {"fields": self.get_fields(request, obj)})]

    def get_queryset(self, request: HttpRequest) -> QuerySet[Developer]:
        return super().get_queryset(request).filter(is_library=False)

    def save_model(self, request: HttpRequest, obj: Developer, form: ModelForm, change: bool) -> None:  # type: ignore[type-arg]
        developer_id = tenancy.create_developer(
            obj.name,
            obj.market_id,
            home_region=form.cleaned_data["home_region"],
            actor_user_id=request.user.pk,
        )
        request.session[tenancy.STAFF_SESSION_TENANT] = str(developer_id)
        created = Developer.objects.get(id=developer_id)
        obj.__dict__.update(created.__dict__)

    def get_urls(self) -> list[URLPattern]:
        pick = self.admin_site.admin_view(require_POST(self.pick_view))
        return [
            path("<uuid:developer_id>/pick/", pick, name="platform_developer_pick"),
            *super().get_urls(),
        ]

    def changelist_view(
        self, request: HttpRequest, extra_context: dict[str, Any] | None = None
    ) -> HttpResponse:
        acting = tenancy.current_tenant_id()
        developers = [
            {
                "id": choice.id,
                "name": choice.name,
                "url": reverse("admin:platform_developer_pick", args=[choice.id]),
            }
            for choice in tenancy.staff_developers()
        ]
        context = {
            **self.admin_site.each_context(request),
            "title": _("Developers"),
            "developers": developers,
            "acting": acting,
            "add_url": reverse("admin:platform_developer_add"),
        }
        return TemplateResponse(request, _template(PICK), context)

    def pick_view(self, request: HttpRequest, developer_id: uuid.UUID) -> HttpResponse:
        try:
            tenancy.staff_open(request, developer_id)
        except tenancy.NotYours:
            raise Http404 from None
        messages.success(request, _("You now act in this Developer."))
        return HttpResponseRedirect(reverse("admin:platform_developer_change", args=[developer_id]))

    def response_add(
        self, request: HttpRequest, obj: Developer, post_url_continue: str | None = None
    ) -> HttpResponse:
        messages.success(request, _("The Developer is created, and you act in it."))
        return HttpResponseRedirect(reverse("admin:platform_developer_change", args=[obj.pk]))


class FirstInvitationForm(forms.ModelForm):  # type: ignore[type-arg]
    class Meta:
        model = Membership
        fields = ("invited_email",)
        labels: ClassVar = {"invited_email": gettext_lazy("The first MD's email")}

    request: HttpRequest

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self.fields["invited_email"].required = True

    def clean_invited_email(self) -> str:
        email: str = self.cleaned_data["invited_email"]
        refused = tenancy.first_md_refusal(email, invited_by=self.request.user)  # type: ignore[arg-type]
        if refused is not None:
            raise forms.ValidationError(REFUSALS[refused.reason]())
        return email


REFUSALS = {
    "no_developer": lambda: _("Pick the Developer to act in first."),
    "staff": lambda: _(
        "Vextrus's staff never invite themselves or each other: a Vextrus Engineer enters only "
        "by a Developer's own invitation."
    ),
    "not_first": lambda: _(
        "This Developer already has a current Membership or a pending invitation. Its MD invites "
        "everyone else."
    ),
}


@admin.register(Membership)
class MembershipAdmin(TenantModelAdmin):
    """The acting Developer's Memberships, read-only; staff add only its first MD invitation (again,
    once every Membership and invitation it had has ended)."""

    form = FirstInvitationForm
    list_display = ("role", "user", "invited_email", "accepted_at", "expires_at", "revoked_at")

    def get_queryset(self, request: HttpRequest) -> QuerySet[Membership]:
        # The user's own Memberships in other Developers are readable too; the admin shows only
        # the acting Developer's.
        tenant_id = tenancy.current_tenant_id()
        found = super().get_queryset(request)
        return found.filter(tenant_id=tenant_id) if tenant_id else found.none()

    def has_add_permission(self, request: HttpRequest) -> bool:
        tenant_id = tenancy.current_tenant_id()
        return (
            super().has_add_permission(request)
            and tenant_id is not None
            and not tenancy.has_live_membership(tenant_id)
        )

    def has_change_permission(self, request: HttpRequest, obj: Model | None = None) -> bool:
        return False

    def get_form(
        self, request: HttpRequest, obj: Model | None = None, change: bool = False, **kwargs: Any
    ) -> type[ModelForm]:  # type: ignore[type-arg]
        form = super().get_form(request, obj, change, **kwargs)
        return type(form.__name__, (form,), {"request": request})

    def save_model(self, request: HttpRequest, obj: Membership, form: ModelForm, change: bool) -> None:  # type: ignore[type-arg]
        invitation = tenancy.invite_first_md(obj.invited_email, invited_by=request.user)  # type: ignore[arg-type]
        obj.__dict__.update(Membership.objects.get(id=invitation.membership_id).__dict__)
        messages.warning(
            request,
            _("Send this invitation link to the MD; it is shown only now: %(link)s")
            % {"link": invitations.link(invitation.token)},
        )

    def response_add(
        self, request: HttpRequest, obj: Membership, post_url_continue: str | None = None
    ) -> HttpResponse:
        return HttpResponseRedirect(reverse("admin:platform_membership_changelist"))
