import { forwardRef, Module } from "@nestjs/common";
import { EmailService } from "./email.service";
import { MailerModule } from "@nestjs-modules/mailer";
import { HandlebarsAdapter } from "@nestjs-modules/mailer/dist/adapters/handlebars.adapter";
import { join } from "path";
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthModule } from '../auth/auth.module';
import { AuthService } from "../auth/auth.service";
import { EmailController } from "./email.controller";

@Module({
  imports: [
    ConfigModule,
    forwardRef(() => AuthModule),
    MailerModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    const transportConfig = {
      host: config.get<string>('MAIL_HOST'),
      port: config.get<number>('MAIL_PORT'),
      auth: {
        user: config.get<string>('MAIL_USER'),
        pass: config.get<string>('MAIL_PASS'),
      },
    };

    // figure out the template directory, with fallback for old asset path
    let templateDir = join(__dirname, 'templates');
    const fs = require('fs');
    if (!fs.existsSync(join(templateDir, 'verify-email.hbs'))) {
      const alt = join(templateDir, 'modules', 'email', 'templates');
      if (fs.existsSync(join(alt, 'verify-email.hbs'))) {
        templateDir = alt;
      }
    }
    console.log('Using mailer templates in', templateDir);

    return {
      transport: transportConfig,
      defaults: {
        from: config.get<string>('MAIL_FROM'),
      },
      template: {
        dir: templateDir, 
        adapter: new HandlebarsAdapter(),
        options: {
          strict: true,
        },
      },
    };
  },
}),
  ],
  providers: [EmailService],
  controllers: [EmailController],
  exports: [EmailService],
})
export class EmailModule {}