export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      account_status: {
        Row: {
          role: Database['public']['Enums']['app_role'];
          suspended_at: string | null;
          suspended_reason: string | null;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          role?: Database['public']['Enums']['app_role'];
          suspended_at?: string | null;
          suspended_reason?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          role?: Database['public']['Enums']['app_role'];
          suspended_at?: string | null;
          suspended_reason?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      app_config: {
        Row: {
          key: string;
          value: NonNullable<Json>;
        };
        ComputedFields: never;
        Insert: {
          key: string;
          value: NonNullable<Json>;
        };
        Update: {
          key?: string;
          value?: NonNullable<Json>;
        };
        Relationships: [];
      };
      brews: {
        Row: {
          acidity: number | null;
          aftertaste: number | null;
          author_handle_snapshot: string | null;
          balance: number | null;
          beverage_g: number | null;
          body: number | null;
          brewed_at: string;
          brightness: number | null;
          clarity: number | null;
          client_updated_at: string | null;
          created_at: string;
          deleted_at: string | null;
          dose_g_snapshot: number;
          drawdown_s: number | null;
          ey_pct: number | null;
          flavours: string[];
          id: string;
          is_others_recipe: boolean;
          next_change: string | null;
          notes: string | null;
          overall: number;
          recipe_id: string | null;
          recipe_name_snapshot: string;
          recipe_version_id: string | null;
          source: Database['public']['Enums']['brew_source'];
          sweetness: number | null;
          tasted_after_min: number | null;
          tasted_temp: Database['public']['Enums']['tasted_temp'] | null;
          tds_pct: number | null;
          updated_at: string;
          user_id: string;
          version_no_snapshot: number;
        };
        ComputedFields: never;
        Insert: {
          acidity?: number | null;
          aftertaste?: number | null;
          author_handle_snapshot?: string | null;
          balance?: number | null;
          beverage_g?: number | null;
          body?: number | null;
          brewed_at: string;
          brightness?: number | null;
          clarity?: number | null;
          client_updated_at?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          dose_g_snapshot: number;
          drawdown_s?: number | null;
          ey_pct?: number | null;
          flavours?: string[];
          id: string;
          is_others_recipe?: boolean;
          next_change?: string | null;
          notes?: string | null;
          overall: number;
          recipe_id?: string | null;
          recipe_name_snapshot: string;
          recipe_version_id?: string | null;
          source?: Database['public']['Enums']['brew_source'];
          sweetness?: number | null;
          tasted_after_min?: number | null;
          tasted_temp?: Database['public']['Enums']['tasted_temp'] | null;
          tds_pct?: number | null;
          updated_at?: string;
          user_id: string;
          version_no_snapshot: number;
        };
        Update: {
          acidity?: number | null;
          aftertaste?: number | null;
          author_handle_snapshot?: string | null;
          balance?: number | null;
          beverage_g?: number | null;
          body?: number | null;
          brewed_at?: string;
          brightness?: number | null;
          clarity?: number | null;
          client_updated_at?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          dose_g_snapshot?: number;
          drawdown_s?: number | null;
          ey_pct?: number | null;
          flavours?: string[];
          id?: string;
          is_others_recipe?: boolean;
          next_change?: string | null;
          notes?: string | null;
          overall?: number;
          recipe_id?: string | null;
          recipe_name_snapshot?: string;
          recipe_version_id?: string | null;
          source?: Database['public']['Enums']['brew_source'];
          sweetness?: number | null;
          tasted_after_min?: number | null;
          tasted_temp?: Database['public']['Enums']['tasted_temp'] | null;
          tds_pct?: number | null;
          updated_at?: string;
          user_id?: string;
          version_no_snapshot?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'brews_recipe_id_fkey';
            columns: ['recipe_id'];
            isOneToOne: false;
            referencedRelation: 'recipes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'brews_recipe_version_id_fkey';
            columns: ['recipe_version_id'];
            isOneToOne: false;
            referencedRelation: 'recipe_versions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'brews_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      events: {
        Row: {
          anon_id: string | null;
          created_at: string;
          id: number;
          name: string;
          props: NonNullable<Json>;
          recipe_id: string | null;
          user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          anon_id?: string | null;
          created_at?: string;
          id?: never;
          name: string;
          props?: NonNullable<Json>;
          recipe_id?: string | null;
          user_id?: string | null;
        };
        Update: {
          anon_id?: string | null;
          created_at?: string;
          id?: never;
          name?: string;
          props?: NonNullable<Json>;
          recipe_id?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'events_recipe_id_fkey';
            columns: ['recipe_id'];
            isOneToOne: false;
            referencedRelation: 'recipes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'events_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      gear_catalog: {
        Row: {
          brand: string;
          category: Database['public']['Enums']['gear_category'];
          id: string;
          is_active: boolean;
          model: string;
          name: string | null;
        };
        ComputedFields: never;
        Insert: {
          brand: string;
          category: Database['public']['Enums']['gear_category'];
          id?: string;
          is_active?: boolean;
          model: string;
          name?: never;
        };
        Update: {
          brand?: string;
          category?: Database['public']['Enums']['gear_category'];
          id?: string;
          is_active?: boolean;
          model?: string;
          name?: never;
        };
        Relationships: [];
      };
      gear_items: {
        Row: {
          catalog_id: string | null;
          category: Database['public']['Enums']['gear_category'];
          created_at: string;
          custom_name: string | null;
          id: string;
          is_default: boolean;
          nickname: string | null;
          notes: string | null;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          catalog_id?: string | null;
          category: Database['public']['Enums']['gear_category'];
          created_at?: string;
          custom_name?: string | null;
          id?: string;
          is_default?: boolean;
          nickname?: string | null;
          notes?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          catalog_id?: string | null;
          category?: Database['public']['Enums']['gear_category'];
          created_at?: string;
          custom_name?: string | null;
          id?: string;
          is_default?: boolean;
          nickname?: string | null;
          notes?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'gear_items_catalog_id_fkey';
            columns: ['catalog_id'];
            isOneToOne: false;
            referencedRelation: 'gear_catalog';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'gear_items_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      handle_history: {
        Row: {
          changed_at: string;
          old_handle: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          changed_at?: string;
          old_handle: string;
          user_id: string;
        };
        Update: {
          changed_at?: string;
          old_handle?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'handle_history_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      moderation_actions: {
        Row: {
          action: Database['public']['Enums']['mod_action'];
          created_at: string;
          id: number;
          moderator_id: string | null;
          reason: string | null;
          target_id: string;
          target_type: string;
        };
        ComputedFields: never;
        Insert: {
          action: Database['public']['Enums']['mod_action'];
          created_at?: string;
          id?: never;
          moderator_id?: string | null;
          reason?: string | null;
          target_id: string;
          target_type: string;
        };
        Update: {
          action?: Database['public']['Enums']['mod_action'];
          created_at?: string;
          id?: never;
          moderator_id?: string | null;
          reason?: string | null;
          target_id?: string;
          target_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'moderation_actions_moderator_id_fkey';
            columns: ['moderator_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      notifications: {
        Row: {
          actor_id: string | null;
          created_at: string;
          id: string;
          payload: NonNullable<Json>;
          read_at: string | null;
          recipe_id: string | null;
          type: Database['public']['Enums']['notification_type'];
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          actor_id?: string | null;
          created_at?: string;
          id?: string;
          payload?: NonNullable<Json>;
          read_at?: string | null;
          recipe_id?: string | null;
          type: Database['public']['Enums']['notification_type'];
          user_id: string;
        };
        Update: {
          actor_id?: string | null;
          created_at?: string;
          id?: string;
          payload?: NonNullable<Json>;
          read_at?: string | null;
          recipe_id?: string | null;
          type?: Database['public']['Enums']['notification_type'];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notifications_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notifications_recipe_id_fkey';
            columns: ['recipe_id'];
            isOneToOne: false;
            referencedRelation: 'recipes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notifications_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_path: string | null;
          bio: string | null;
          created_at: string;
          display_name: string;
          experience_level: Database['public']['Enums']['experience_level'] | null;
          favourite_gear: NonNullable<Json>;
          handle: string;
          handle_confirmed: boolean;
          hidden_at: string | null;
          hidden_reason: string | null;
          id: string;
          is_verified: boolean;
          updated_at: string;
          verified_at: string | null;
        };
        ComputedFields: never;
        Insert: {
          avatar_path?: string | null;
          bio?: string | null;
          created_at?: string;
          display_name: string;
          experience_level?: Database['public']['Enums']['experience_level'] | null;
          favourite_gear?: NonNullable<Json>;
          handle: string;
          handle_confirmed?: boolean;
          hidden_at?: string | null;
          hidden_reason?: string | null;
          id: string;
          is_verified?: boolean;
          updated_at?: string;
          verified_at?: string | null;
        };
        Update: {
          avatar_path?: string | null;
          bio?: string | null;
          created_at?: string;
          display_name?: string;
          experience_level?: Database['public']['Enums']['experience_level'] | null;
          favourite_gear?: NonNullable<Json>;
          handle?: string;
          handle_confirmed?: boolean;
          hidden_at?: string | null;
          hidden_reason?: string | null;
          id?: string;
          is_verified?: boolean;
          updated_at?: string;
          verified_at?: string | null;
        };
        Relationships: [];
      };
      publish_log: {
        Row: {
          created_at: string;
          id: number;
          recipe_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: never;
          recipe_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: never;
          recipe_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'publish_log_recipe_id_fkey';
            columns: ['recipe_id'];
            isOneToOne: false;
            referencedRelation: 'recipes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'publish_log_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      recipe_counters: {
        Row: {
          brewed_by_others: number;
          copies: number;
          owner_brews: number;
          recipe_id: string;
          saves: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          brewed_by_others?: number;
          copies?: number;
          owner_brews?: number;
          recipe_id: string;
          saves?: number;
          updated_at?: string;
        };
        Update: {
          brewed_by_others?: number;
          copies?: number;
          owner_brews?: number;
          recipe_id?: string;
          saves?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'recipe_counters_recipe_id_fkey';
            columns: ['recipe_id'];
            isOneToOne: true;
            referencedRelation: 'recipes';
            referencedColumns: ['id'];
          },
        ];
      };
      recipe_versions: {
        Row: {
          altitude_m: number | null;
          brew_water_g: number;
          brewer_catalog_id: string | null;
          bypass_g: number;
          bypass_timing: Database['public']['Enums']['bypass_timing'];
          change_note: string | null;
          coffee_name: string | null;
          colour_reading: number | null;
          colour_scale: string | null;
          created_at: string;
          dose_g: number;
          drawdown_max_s: number | null;
          drawdown_min_s: number | null;
          ey_max: number | null;
          ey_min: number | null;
          gear: NonNullable<Json>;
          grind_microns: number | null;
          grind_setting: string | null;
          grinder_catalog_id: string | null;
          id: string;
          locked_at: string | null;
          notes: string | null;
          origin: string | null;
          process: string | null;
          recipe_id: string;
          retention_ratio: number | null;
          roast_date: string | null;
          roast_level: Database['public']['Enums']['roast_level'] | null;
          roaster: string | null;
          steps: NonNullable<Json>;
          steps_schema: number;
          tds_max: number | null;
          tds_min: number | null;
          temp_c: number | null;
          updated_at: string;
          varietal: string | null;
          version_no: number;
          water_ppm: number | null;
        };
        ComputedFields: never;
        Insert: {
          altitude_m?: number | null;
          brew_water_g: number;
          brewer_catalog_id?: string | null;
          bypass_g?: number;
          bypass_timing?: Database['public']['Enums']['bypass_timing'];
          change_note?: string | null;
          coffee_name?: string | null;
          colour_reading?: number | null;
          colour_scale?: string | null;
          created_at?: string;
          dose_g: number;
          drawdown_max_s?: number | null;
          drawdown_min_s?: number | null;
          ey_max?: number | null;
          ey_min?: number | null;
          gear?: NonNullable<Json>;
          grind_microns?: number | null;
          grind_setting?: string | null;
          grinder_catalog_id?: string | null;
          id?: string;
          locked_at?: string | null;
          notes?: string | null;
          origin?: string | null;
          process?: string | null;
          recipe_id: string;
          retention_ratio?: number | null;
          roast_date?: string | null;
          roast_level?: Database['public']['Enums']['roast_level'] | null;
          roaster?: string | null;
          steps?: NonNullable<Json>;
          steps_schema?: number;
          tds_max?: number | null;
          tds_min?: number | null;
          temp_c?: number | null;
          updated_at?: string;
          varietal?: string | null;
          version_no: number;
          water_ppm?: number | null;
        };
        Update: {
          altitude_m?: number | null;
          brew_water_g?: number;
          brewer_catalog_id?: string | null;
          bypass_g?: number;
          bypass_timing?: Database['public']['Enums']['bypass_timing'];
          change_note?: string | null;
          coffee_name?: string | null;
          colour_reading?: number | null;
          colour_scale?: string | null;
          created_at?: string;
          dose_g?: number;
          drawdown_max_s?: number | null;
          drawdown_min_s?: number | null;
          ey_max?: number | null;
          ey_min?: number | null;
          gear?: NonNullable<Json>;
          grind_microns?: number | null;
          grind_setting?: string | null;
          grinder_catalog_id?: string | null;
          id?: string;
          locked_at?: string | null;
          notes?: string | null;
          origin?: string | null;
          process?: string | null;
          recipe_id?: string;
          retention_ratio?: number | null;
          roast_date?: string | null;
          roast_level?: Database['public']['Enums']['roast_level'] | null;
          roaster?: string | null;
          steps?: NonNullable<Json>;
          steps_schema?: number;
          tds_max?: number | null;
          tds_min?: number | null;
          temp_c?: number | null;
          updated_at?: string;
          varietal?: string | null;
          version_no?: number;
          water_ppm?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'recipe_versions_brewer_catalog_id_fkey';
            columns: ['brewer_catalog_id'];
            isOneToOne: false;
            referencedRelation: 'gear_catalog';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'recipe_versions_grinder_catalog_id_fkey';
            columns: ['grinder_catalog_id'];
            isOneToOne: false;
            referencedRelation: 'gear_catalog';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'recipe_versions_recipe_id_fkey';
            columns: ['recipe_id'];
            isOneToOne: false;
            referencedRelation: 'recipes';
            referencedColumns: ['id'];
          },
        ];
      };
      recipes: {
        Row: {
          archived_at: string | null;
          created_at: string;
          deleted_at: string | null;
          forked_from_owner_id: string | null;
          forked_from_recipe_id: string | null;
          forked_from_version_id: string | null;
          forked_from_version_no: number | null;
          hidden_at: string | null;
          hidden_reason: string | null;
          id: string;
          is_copy: boolean;
          last_brewed_at: string | null;
          latest_version_id: string | null;
          latest_version_no: number;
          method: Database['public']['Enums']['brew_method'];
          method_custom: string | null;
          name: string;
          owner_id: string;
          published_at: string | null;
          slug: string;
          updated_at: string;
          visibility: Database['public']['Enums']['recipe_visibility'];
        };
        ComputedFields: never;
        Insert: {
          archived_at?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          forked_from_owner_id?: string | null;
          forked_from_recipe_id?: string | null;
          forked_from_version_id?: string | null;
          forked_from_version_no?: number | null;
          hidden_at?: string | null;
          hidden_reason?: string | null;
          id?: string;
          is_copy?: boolean;
          last_brewed_at?: string | null;
          latest_version_id?: string | null;
          latest_version_no?: number;
          method: Database['public']['Enums']['brew_method'];
          method_custom?: string | null;
          name: string;
          owner_id: string;
          published_at?: string | null;
          slug: string;
          updated_at?: string;
          visibility?: Database['public']['Enums']['recipe_visibility'];
        };
        Update: {
          archived_at?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          forked_from_owner_id?: string | null;
          forked_from_recipe_id?: string | null;
          forked_from_version_id?: string | null;
          forked_from_version_no?: number | null;
          hidden_at?: string | null;
          hidden_reason?: string | null;
          id?: string;
          is_copy?: boolean;
          last_brewed_at?: string | null;
          latest_version_id?: string | null;
          latest_version_no?: number;
          method?: Database['public']['Enums']['brew_method'];
          method_custom?: string | null;
          name?: string;
          owner_id?: string;
          published_at?: string | null;
          slug?: string;
          updated_at?: string;
          visibility?: Database['public']['Enums']['recipe_visibility'];
        };
        Relationships: [
          {
            foreignKeyName: 'recipes_forked_from_owner_id_fkey';
            columns: ['forked_from_owner_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'recipes_forked_from_recipe_id_fkey';
            columns: ['forked_from_recipe_id'];
            isOneToOne: false;
            referencedRelation: 'recipes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'recipes_forked_from_version_fk';
            columns: ['forked_from_version_id'];
            isOneToOne: false;
            referencedRelation: 'recipe_versions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'recipes_latest_version_fk';
            columns: ['latest_version_id'];
            isOneToOne: false;
            referencedRelation: 'recipe_versions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'recipes_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      reports: {
        Row: {
          created_at: string;
          details: string | null;
          handled_at: string | null;
          handled_by: string | null;
          id: string;
          reason: Database['public']['Enums']['report_reason'];
          reporter_id: string | null;
          status: Database['public']['Enums']['report_status'];
          target_id: string;
          target_type: Database['public']['Enums']['report_target'];
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          details?: string | null;
          handled_at?: string | null;
          handled_by?: string | null;
          id?: string;
          reason: Database['public']['Enums']['report_reason'];
          reporter_id?: string | null;
          status?: Database['public']['Enums']['report_status'];
          target_id: string;
          target_type: Database['public']['Enums']['report_target'];
        };
        Update: {
          created_at?: string;
          details?: string | null;
          handled_at?: string | null;
          handled_by?: string | null;
          id?: string;
          reason?: Database['public']['Enums']['report_reason'];
          reporter_id?: string | null;
          status?: Database['public']['Enums']['report_status'];
          target_id?: string;
          target_type?: Database['public']['Enums']['report_target'];
        };
        Relationships: [
          {
            foreignKeyName: 'reports_handled_by_fkey';
            columns: ['handled_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reports_reporter_id_fkey';
            columns: ['reporter_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      reserved_handles: {
        Row: {
          handle: string;
        };
        ComputedFields: never;
        Insert: {
          handle: string;
        };
        Update: {
          handle?: string;
        };
        Relationships: [];
      };
      saved_recipes: {
        Row: {
          created_at: string;
          recipe_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          recipe_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          recipe_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'saved_recipes_recipe_id_fkey';
            columns: ['recipe_id'];
            isOneToOne: false;
            referencedRelation: 'recipes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'saved_recipes_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      signup_allowlist: {
        Row: {
          created_at: string;
          email: string;
          invited_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          email: string;
          invited_by?: string | null;
        };
        Update: {
          created_at?: string;
          email?: string;
          invited_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'signup_allowlist_invited_by_fkey';
            columns: ['invited_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      user_settings: {
        Row: {
          date_format: string;
          onboarding: NonNullable<Json>;
          temp_unit: string;
          time_format: string;
          time_zone: string;
          updated_at: string;
          user_id: string;
          weight_unit: string;
        };
        ComputedFields: never;
        Insert: {
          date_format?: string;
          onboarding?: NonNullable<Json>;
          temp_unit?: string;
          time_format?: string;
          time_zone?: string;
          updated_at?: string;
          user_id: string;
          weight_unit?: string;
        };
        Update: {
          date_format?: string;
          onboarding?: NonNullable<Json>;
          temp_unit?: string;
          time_format?: string;
          time_zone?: string;
          updated_at?: string;
          user_id?: string;
          weight_unit?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      admin_set_role: {
        Args: { p_role: Database['public']['Enums']['app_role']; p_user_id: string };
        Returns: undefined;
      };
      can_sign_up: { Args: { p_email: string }; Returns: boolean };
      copy_recipe: {
        Args: { p_version_id: string };
        Returns: {
          archived_at: string | null;
          created_at: string;
          deleted_at: string | null;
          forked_from_owner_id: string | null;
          forked_from_recipe_id: string | null;
          forked_from_version_id: string | null;
          forked_from_version_no: number | null;
          hidden_at: string | null;
          hidden_reason: string | null;
          id: string;
          is_copy: boolean;
          last_brewed_at: string | null;
          latest_version_id: string | null;
          latest_version_no: number;
          method: Database['public']['Enums']['brew_method'];
          method_custom: string | null;
          name: string;
          owner_id: string;
          published_at: string | null;
          slug: string;
          updated_at: string;
          visibility: Database['public']['Enums']['recipe_visibility'];
        };
        SetofOptions: {
          from: '*';
          to: 'recipes';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_recipe: {
        Args: {
          p_method: Database['public']['Enums']['brew_method'];
          p_method_custom: string;
          p_name: string;
          p_version: Json;
        };
        Returns: {
          archived_at: string | null;
          created_at: string;
          deleted_at: string | null;
          forked_from_owner_id: string | null;
          forked_from_recipe_id: string | null;
          forked_from_version_id: string | null;
          forked_from_version_no: number | null;
          hidden_at: string | null;
          hidden_reason: string | null;
          id: string;
          is_copy: boolean;
          last_brewed_at: string | null;
          latest_version_id: string | null;
          latest_version_no: number;
          method: Database['public']['Enums']['brew_method'];
          method_custom: string | null;
          name: string;
          owner_id: string;
          published_at: string | null;
          slug: string;
          updated_at: string;
          visibility: Database['public']['Enums']['recipe_visibility'];
        };
        SetofOptions: {
          from: '*';
          to: 'recipes';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_version: {
        Args: { p_recipe_id: string; p_version: Json };
        Returns: {
          altitude_m: number | null;
          brew_water_g: number;
          brewer_catalog_id: string | null;
          bypass_g: number;
          bypass_timing: Database['public']['Enums']['bypass_timing'];
          change_note: string | null;
          coffee_name: string | null;
          colour_reading: number | null;
          colour_scale: string | null;
          created_at: string;
          dose_g: number;
          drawdown_max_s: number | null;
          drawdown_min_s: number | null;
          ey_max: number | null;
          ey_min: number | null;
          gear: NonNullable<Json>;
          grind_microns: number | null;
          grind_setting: string | null;
          grinder_catalog_id: string | null;
          id: string;
          locked_at: string | null;
          notes: string | null;
          origin: string | null;
          process: string | null;
          recipe_id: string;
          retention_ratio: number | null;
          roast_date: string | null;
          roast_level: Database['public']['Enums']['roast_level'] | null;
          roaster: string | null;
          steps: NonNullable<Json>;
          steps_schema: number;
          tds_max: number | null;
          tds_min: number | null;
          temp_c: number | null;
          updated_at: string;
          varietal: string | null;
          version_no: number;
          water_ppm: number | null;
        };
        SetofOptions: {
          from: '*';
          to: 'recipe_versions';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      email_is_verified: { Args: { uid: string }; Returns: boolean };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_moderator: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_suspended: { Args: { uid: string }; Returns: boolean };
      log_event: {
        Args: { p_anon_id?: string; p_name: string; p_props?: Json; p_recipe_id?: string };
        Returns: undefined;
      };
      make_slug: { Args: { p_name: string; p_owner: string }; Returns: string };
      mod_resolve_report: {
        Args: { p_report_id: string; p_status: Database['public']['Enums']['report_status'] };
        Returns: undefined;
      };
      mod_set_recipe_hidden: {
        Args: { p_hidden: boolean; p_reason: string; p_recipe_id: string };
        Returns: undefined;
      };
      mod_set_suspended: {
        Args: { p_reason: string; p_suspended: boolean; p_user_id: string };
        Returns: undefined;
      };
      mod_set_verified: { Args: { p_user_id: string; p_verified: boolean }; Returns: undefined };
      profile_stats: {
        Args: { p_user_id: string };
        Returns: {
          brewed_by_others: number;
          brews: number;
          public_recipes: number;
          recipes: number;
          versions: number;
        }[];
      };
      recipe_is_public: { Args: { r_id: string }; Returns: boolean };
      verified_recipes: {
        Args: {
          p_before?: string;
          p_limit?: number;
          p_method?: Database['public']['Enums']['brew_method'];
        };
        Returns: {
          avatar_path: string;
          brewed_by_others: number;
          latest_version_no: number;
          method: Database['public']['Enums']['brew_method'];
          name: string;
          owner_brews: number;
          owner_handle: string;
          owner_name: string;
          published_at: string;
          recipe_id: string;
          slug: string;
        }[];
      };
    };
    Enums: {
      app_role: 'member' | 'moderator' | 'admin';
      brew_method:
        | 'pour_over'
        | 'immersion'
        | 'hybrid'
        | 'aeropress'
        | 'french_press'
        | 'siphon'
        | 'cold_brew'
        | 'other';
      brew_source: 'timer' | 'manual';
      bypass_timing: 'none' | 'before' | 'after';
      experience_level: 'beginner' | 'enthusiast' | 'advanced' | 'professional' | 'competitor';
      gear_category: 'brewer' | 'filter' | 'grinder' | 'kettle' | 'scale' | 'water' | 'other';
      mod_action:
        | 'hide'
        | 'restore'
        | 'suspend'
        | 'unsuspend'
        | 'verify'
        | 'unverify'
        | 'role_change'
        | 'dismiss_report';
      notification_type:
        'verified' | 'recipe_hidden' | 'recipe_restored' | 'recipe_copied' | 'recipe_brewed';
      recipe_visibility: 'private' | 'public';
      report_reason: 'spam' | 'offensive' | 'impersonation' | 'copied_without_credit' | 'other';
      report_status: 'open' | 'dismissed' | 'actioned';
      report_target: 'recipe' | 'profile';
      roast_level: 'light' | 'medium_light' | 'medium' | 'medium_dark' | 'dark';
      tasted_temp: 'hot' | 'warm' | 'cool';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ['member', 'moderator', 'admin'],
      brew_method: [
        'pour_over',
        'immersion',
        'hybrid',
        'aeropress',
        'french_press',
        'siphon',
        'cold_brew',
        'other',
      ],
      brew_source: ['timer', 'manual'],
      bypass_timing: ['none', 'before', 'after'],
      experience_level: ['beginner', 'enthusiast', 'advanced', 'professional', 'competitor'],
      gear_category: ['brewer', 'filter', 'grinder', 'kettle', 'scale', 'water', 'other'],
      mod_action: [
        'hide',
        'restore',
        'suspend',
        'unsuspend',
        'verify',
        'unverify',
        'role_change',
        'dismiss_report',
      ],
      notification_type: [
        'verified',
        'recipe_hidden',
        'recipe_restored',
        'recipe_copied',
        'recipe_brewed',
      ],
      recipe_visibility: ['private', 'public'],
      report_reason: ['spam', 'offensive', 'impersonation', 'copied_without_credit', 'other'],
      report_status: ['open', 'dismissed', 'actioned'],
      report_target: ['recipe', 'profile'],
      roast_level: ['light', 'medium_light', 'medium', 'medium_dark', 'dark'],
      tasted_temp: ['hot', 'warm', 'cool'],
    },
  },
} as const;
