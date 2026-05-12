import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    const secret = process.env.JWT_SECRET || 'your-secret-key';
    console.log('🔐 JwtStrategy constructor - Using secret:', secret);
    console.log('🔐 JwtStrategy constructor - process.env.JWT_SECRET:', process.env.JWT_SECRET);

    // custom extractor to log the incoming Authorization header and token
    const extractor = (req: any) => {
      try {
        const header = req && req.headers ? req.headers.authorization : undefined;
        console.log('🔍 JwtStrategy extractor - Authorization header:', header ? header.substring(0, 200) : 'MISSING');
        if (!header) return null;
        const parts = header.split(' ');
        if (parts.length === 2 && /^Bearer$/i.test(parts[0])) {
          const token = parts[1];
          console.log('🔍 JwtStrategy extractor - Token extracted (start):', token.substring(0, 60) + '...');
          return token;
        }
        return null;
      } catch (err) {
        console.log('⚠️ JwtStrategy extractor error:', err);
        return null;
      }
    };

    super({
      jwtFromRequest: extractor,
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  validate(payload: any) {
    console.log('🔐 JwtStrategy.validate() called with payload:', JSON.stringify(payload));
    console.log('✅ JwtStrategy validation passed');
    return {
      id: payload.id,
      email: payload.email,
    };
  }
}
