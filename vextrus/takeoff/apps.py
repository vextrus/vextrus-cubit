from django.apps import AppConfig


class TakeoffConfig(AppConfig):
    name = "vextrus.takeoff"
    label = "takeoff"
    verbose_name = "Takeoff"

    def ready(self) -> None:
        # Step 1 follows a file's Discipline the QS changes in `drawings` (a layer below it: #159).
        from vextrus.drawings import services as drawings
        from vextrus.takeoff.services import step1
        from vextrus.takeoff.services.read_propose import proposals

        drawings.before_discipline_change(step1.lock_writes)  # Step 1's write lock first (#227)
        drawings.on_discipline_changed(proposals.follow_discipline)
