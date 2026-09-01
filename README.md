1. Pare-feu (pour que le PC comptoir puisse joindre le serveur)
Toujours en PowerShell admin :


New-NetFirewallRule -DisplayName "VenteApp" -Direction Inbound -Protocol TCP -LocalPort 8000 -Action Allow
2. Trouver l'IP du PC serveur

ipconfig
Cherche la ligne IPv4 (généralement sous "Carte Ethernet" ou "Wi-Fi"), du genre 192.168.1.XX. C'est cette adresse que le PC comptoir utilisera : http://192.168.1.XX:8000.

Envoie-moi le résultat des deux (ou juste dis-moi si le pare-feu passe bien, et donne-moi l'IP trouvée).




←[32mINFO←[0m:     127.0.0.1:64142 - "←[1mGET /api/v1/facturations/ HTTP/1.1←[0m" ←[91m500 Internal Server Error←[0m
←[31mERROR←[0m:    Exception in ASGI application
Traceback (most recent call last):
  File "C:\Python314\Lib\site-packages\sqlalchemy\engine\base.py", line 1969, in _exec_single_context
    self.dialect.do_execute(
    ~~~~~~~~~~~~~~~~~~~~~~~^
        cursor, str_statement, effective_parameters, context
        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    )
    ^
  File "C:\Python314\Lib\site-packages\sqlalchemy\engine\default.py", line 952, in do_execute
    cursor.execute(statement, parameters)
    ~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^
psycopg2.errors.UndefinedColumn: ERREUR:  la colonne facturations.montant_retourne n'existe pas
LINE 1: ...urations.montant_ttc AS facturations_montant_ttc, facturatio...
                                                             ^


The above exception was the direct cause of the following exception:

Traceback (most recent call last):
  File "C:\Python314\Lib\site-packages\uvicorn\protocols\http\httptools_impl.py", line 422, in run_asgi
    result = await app(  # type: ignore[func-returns-value]
             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
        self.scope, self.receive, self.send
        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    )
    ^
  File "C:\Python314\Lib\site-packages\uvicorn\middleware\proxy_headers.py", line 63, in __call__
    return await self.app(scope, receive, send)
           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "C:\Python314\Lib\site-packages\fastapi\applications.py", line 1163, in __call__
    await super().__call__(scope, receive, send)
  File "C:\Python314\Lib\site-packages\starlette\applications.py", line 96, in __call__
    await self.middleware_stack(scope, receive, send)
  File "C:\Python314\Lib\site-packages\starlette\middleware\errors.py", line 186, in __call__
    raise exc
  File "C:\Python314\Lib\site-packages\starlette\middleware\errors.py", line 164, in __call__
    await self.app(scope, receive, _send)
  File "C:\Python314\Lib\site-packages\starlette\middleware\cors.py", line 88, in __call__
    await self.app(scope, receive, send)
  File "C:\Python314\Lib\site-packages\starlette\middleware\exceptions.py", line 63, in __call__
    await wrap_app_handling_exceptions(self.app, conn)(scope, receive, send)
  File "C:\Python314\Lib\site-packages\starlette\_exception_handler.py", line 53, in wrapped_app
    raise exc
  File "C:\Python314\Lib\site-packages\starlette\_exception_handler.py", line 42, in wrapped_app
    await app(scope, receive, sender)
  File "C:\Python314\Lib\site-packages\fastapi\middleware\asyncexitstack.py", line 18, in __call__
    await self.app(scope, receive, send)
  File "C:\Python314\Lib\site-packages\starlette\routing.py", line 670, in __call__
    await self.middleware_stack(scope, receive, send)
  File "C:\Python314\Lib\site-packages\fastapi\routing.py", line 2734, in app
    await route.handle(scope, receive, send)
  File "C:\Python314\Lib\site-packages\fastapi\routing.py", line 1780, in handle
    await self.original_router.handle(scope, receive, send)
  File "C:\Python314\Lib\site-packages\fastapi\routing.py", line 2789, in handle
    await included_router._handle_selected(scope, receive, send)
  File "C:\Python314\Lib\site-packages\fastapi\routing.py", line 1791, in _handle_selected
    await route.handle(scope, receive, send)
  File "C:\Python314\Lib\site-packages\fastapi\routing.py", line 1780, in handle
    await self.original_router.handle(scope, receive, send)
  File "C:\Python314\Lib\site-packages\fastapi\routing.py", line 2789, in handle
    await included_router._handle_selected(scope, receive, send)
  File "C:\Python314\Lib\site-packages\fastapi\routing.py", line 1800, in _handle_selected
    await original_route.handle(scope, receive, send)
  File "C:\Python314\Lib\site-packages\fastapi\routing.py", line 1279, in handle
    await app(scope, receive, send)
  File "C:\Python314\Lib\site-packages\fastapi\routing.py", line 158, in app
    await wrap_app_handling_exceptions(app, request)(scope, receive, send)
  File "C:\Python314\Lib\site-packages\starlette\_exception_handler.py", line 53, in wrapped_app
    raise exc
  File "C:\Python314\Lib\site-packages\starlette\_exception_handler.py", line 42, in wrapped_app
    await app(scope, receive, sender)
  File "C:\Python314\Lib\site-packages\fastapi\routing.py", line 144, in app
    response = await f(request)
               ^^^^^^^^^^^^^^^^
  File "C:\Python314\Lib\site-packages\fastapi\routing.py", line 706, in app
    raw_response = await run_endpoint_function(
                   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    ...<3 lines>...
    )
    ^
  File "C:\Python314\Lib\site-packages\fastapi\routing.py", line 354, in run_endpoint_function
    return await run_in_threadpool(dependant.call, **values)
           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "C:\Python314\Lib\site-packages\starlette\concurrency.py", line 34, in run_in_threadpool
    return await anyio.to_thread.run_sync(func)
           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "C:\Python314\Lib\site-packages\anyio\to_thread.py", line 65, in run_sync
    return await get_async_backend().run_sync_in_worker_thread(
           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
        func, args, abandon_on_cancel=abandon_on_cancel, limiter=limiter
        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    )
    ^
  File "C:\Python314\Lib\site-packages\anyio\_backends\_asyncio.py", line 2641, in run_sync_in_worker_thread
    return await future
           ^^^^^^^^^^^^
  File "C:\Python314\Lib\site-packages\anyio\_backends\_asyncio.py", line 1033, in run
    result = context.run(func, *args)
  File "C:\VenteApp\backend\app\api\v1\facturations.py", line 29, in list_facturations
    return query.order_by(Facturation.date_facturation.desc()).all()
           ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~^^
  File "C:\Python314\Lib\site-packages\sqlalchemy\orm\query.py", line 2711, in all
    return self._iter().all()  # type: ignore
           ~~~~~~~~~~^^
  File "C:\Python314\Lib\site-packages\sqlalchemy\orm\query.py", line 2864, in _iter
    result: Union[ScalarResult[_T], Result[_T]] = self.session.execute(
                                                  ~~~~~~~~~~~~~~~~~~~~^
        statement,
        ^^^^^^^^^^
        params,
        ^^^^^^^
        execution_options={"_sa_orm_load_options": self.load_options},
        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    )
    ^
  File "C:\Python314\Lib\site-packages\sqlalchemy\orm\session.py", line 2373, in execute
    return self._execute_internal(
           ~~~~~~~~~~~~~~~~~~~~~~^
        statement,
        ^^^^^^^^^^
    ...<4 lines>...
        _add_event=_add_event,
        ^^^^^^^^^^^^^^^^^^^^^^
    )
    ^
  File "C:\Python314\Lib\site-packages\sqlalchemy\orm\session.py", line 2271, in _execute_internal
    result: Result[Any] = compile_state_cls.orm_execute_statement(
                          ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~^
        self,
        ^^^^^
    ...<4 lines>...
        conn,
        ^^^^^
    )
    ^
  File "C:\Python314\Lib\site-packages\sqlalchemy\orm\context.py", line 306, in orm_execute_statement
    result = conn.execute(
        statement, params or {}, execution_options=execution_options
    )
  File "C:\Python314\Lib\site-packages\sqlalchemy\engine\base.py", line 1421, in execute
    return meth(
        self,
        distilled_parameters,
        execution_options or NO_OPTIONS,
    )
  File "C:\Python314\Lib\site-packages\sqlalchemy\sql\elements.py", line 526, in _execute_on_connection
    return connection._execute_clauseelement(
           ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~^
        self, distilled_params, execution_options
        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    )
    ^
  File "C:\Python314\Lib\site-packages\sqlalchemy\engine\base.py", line 1643, in _execute_clauseelement
    ret = self._execute_context(
        dialect,
    ...<8 lines>...
        cache_hit=cache_hit,
    )
  File "C:\Python314\Lib\site-packages\sqlalchemy\engine\base.py", line 1848, in _execute_context
    return self._exec_single_context(
           ~~~~~~~~~~~~~~~~~~~~~~~~~^
        dialect, context, statement, parameters
        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    )
    ^
  File "C:\Python314\Lib\site-packages\sqlalchemy\engine\base.py", line 1988, in _exec_single_context
    self._handle_dbapi_exception(
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~^
        e, str_statement, effective_parameters, cursor, context
        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    )
    ^
  File "C:\Python314\Lib\site-packages\sqlalchemy\engine\base.py", line 2365, in _handle_dbapi_exception
    raise sqlalchemy_exception.with_traceback(exc_info[2]) from e
  File "C:\Python314\Lib\site-packages\sqlalchemy\engine\base.py", line 1969, in _exec_single_context
    self.dialect.do_execute(
    ~~~~~~~~~~~~~~~~~~~~~~~^
        cursor, str_statement, effective_parameters, context
        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    )
    ^
  File "C:\Python314\Lib\site-packages\sqlalchemy\engine\default.py", line 952, in do_execute
    cursor.execute(statement, parameters)
    ~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^
sqlalchemy.exc.ProgrammingError: (psycopg2.errors.UndefinedColumn) ERREUR:  la colonne facturations.montant_retourne n'existe pas
LINE 1: ...urations.montant_ttc AS facturations_montant_ttc, facturatio...
                                                             ^

[SQL: SELECT facturations.id_facturation AS facturations_id_facturation, facturations.numero_facture AS facturations_numero_facture, facturations.id_client AS facturations_id_client, facturations.periode_debut AS facturations_periode_debut, facturations.periode_fin AS facturations_periode_fin, facturations.date_facturation AS facturations_date_facturation, facturations.montant_ht AS facturations_montant_ht, facturations.montant_tva AS facturations_montant_tva, facturations.montant_timbre AS facturations_montant_timbre, facturations.montant_ttc AS facturations_montant_ttc, facturations.montant_retourne AS facturations_montant_retourne, facturations.montant_paye AS facturations_montant_paye, facturations.montant_restant AS facturations_montant_restant, facturations.remise_pct AS facturations_remise_pct, facturations.statut AS facturations_statut, facturations.id_utilisateur AS facturations_id_utilisateur
FROM facturations ORDER BY facturations.date_facturation DESC]
(Background on this error at: https://sqlalche.me/e/20/f405)
←[32mINFO←[0m:     127.0.0.1:64143 - "←[1mGET /api/v1/clients/?search=&actif_only=true HTTP/1.1←[0m" ←[32m200 OK←[0m
