import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable, isObservable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;
    console.log('🔐 JwtAuthGuard.canActivate() called');
    console.log(
      '📨 Authorization header:',
      authHeader ? `Present (${authHeader.substring(0, 80)}...)` : 'MISSING',
    );
    console.log('📍 Request URL:', request.method, request.path);

    const result = super.canActivate(context) as boolean | Promise<boolean> | Observable<boolean>;

    if (typeof result === 'boolean') {
      console.log('🟢 super.canActivate result:', result);
      console.log('👤 request.user after auth:', request.user ? JSON.stringify(request.user) : 'undefined');
      return result;
    }

    if (result && typeof (result as Promise<boolean>).then === 'function') {
      return (result as Promise<boolean>)
        .then((res) => {
          console.log('🟢 super.canActivate result (promise):', res);
          console.log('👤 request.user after auth:', request.user ? JSON.stringify(request.user) : 'undefined');
          return res;
        })
        .catch((err) => {
          console.log('🔴 super.canActivate threw error:', (err as any)?.message ?? err);
          throw err;
        });
    }

    if (isObservable(result)) {
      return (result as Observable<boolean>).pipe(
        tap({
          next: (res) => {
            console.log('🟢 super.canActivate result (observable):', res);
            console.log('👤 request.user after auth:', request.user ? JSON.stringify(request.user) : 'undefined');
          },
          error: (err) => {
            console.log('🔴 super.canActivate threw error (observable):', (err as any)?.message ?? err);
          },
        }),
      );
    }

    return result;
  }
}
