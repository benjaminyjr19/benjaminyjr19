-- Atlas — seed data: one sample preschool centre ("Sunny Grove Preschool")
--
-- HOW TO USE
--   1. Apply the migrations.
--   2. Sign up once in the app (creates your auth user).
--   3. Run this file (Supabase SQL editor or `supabase db execute`).
-- The seed attaches the sample centre to the FIRST auth user so RLS lets you
-- see everything immediately. Mirrors lib/demo/fixtures.ts (preview mode).

create or replace function pg_temp.seed_resource(
  p_centre uuid,
  p_creator uuid,
  p_title text,
  p_description text,
  p_type text,
  p_contributed boolean,
  p_filename text,
  p_mime text,
  p_body text,
  p_created timestamptz
) returns uuid language plpgsql as $$
declare
  v_resource uuid := gen_random_uuid();
  v_version uuid := gen_random_uuid();
begin
  insert into public.resources (
    id, centre_id, title, description, type, status, visibility, mime_type,
    original_filename, has_extracted_text, current_version, created_by,
    contributed, created_at, updated_at
  ) values (
    v_resource, p_centre, p_title, p_description, p_type, 'ready', 'centre',
    p_mime, p_filename, true, 1, p_creator, p_contributed, p_created, p_created
  );

  insert into public.resource_versions (
    id, resource_id, version_number, title, extracted_text, created_by, created_at
  ) values (v_version, v_resource, 1, p_title, p_body, p_creator, p_created);

  insert into public.resource_chunks (
    resource_id, centre_id, version_id, chunk_index, content, token_estimate
  ) values (v_resource, p_centre, v_version, 0, p_body, ceil(length(p_body) / 4.0)::int);

  return v_resource;
end $$;

do $$
declare
  v_user uuid;
  v_centre uuid := gen_random_uuid();
  v_monday date := current_date + ((8 - extract(isodow from current_date))::int % 7);
  v_plan uuid := gen_random_uuid();
  r_curriculum uuid; r_template uuid; r_observation uuid; r_sensory uuid;
  r_policy uuid; r_rainy uuid; r_list uuid; r_puppet uuid; r_water uuid;
  v_content jsonb;
begin
  select id into v_user from auth.users order by created_at limit 1;
  if v_user is null then
    raise exception 'Sign up in the app first, then run seed.sql (it attaches the sample centre to your user).';
  end if;

  insert into public.centres (id, name, timezone)
  values (v_centre, 'Sunny Grove Preschool', 'Asia/Singapore');

  insert into public.centre_members (centre_id, user_id, role)
  values (v_centre, v_user, 'lead');

  insert into public.tags (centre_id, name, kind) values
    (v_centre, 'Language & Literacy', 'domain'),
    (v_centre, 'Numeracy', 'domain'),
    (v_centre, 'Motor Skills', 'domain'),
    (v_centre, 'Discovery of the World', 'domain'),
    (v_centre, 'Social & Emotional', 'domain'),
    (v_centre, 'Aesthetics & Creative Expression', 'domain'),
    (v_centre, 'N1', 'age_group'), (v_centre, 'N2', 'age_group'),
    (v_centre, 'K1', 'age_group'), (v_centre, 'K2', 'age_group'),
    (v_centre, 'Outdoor', 'custom'), (v_centre, 'Sensory', 'custom'),
    (v_centre, 'Nature', 'custom'), (v_centre, 'Template', 'format'),
    (v_centre, 'Policy', 'format');

  -- ── Resources ─────────────────────────────────────────────────────────────

  r_curriculum := pg_temp.seed_resource(v_centre, v_user,
    'NEL Curriculum Guide — Kindergarten 1',
    'Centre adaptation of Singapore''s Nurturing Early Learners framework for K1.',
    'curriculum', false, 'nel-curriculum-guide-k1.pdf', 'application/pdf',
    'Sunny Grove adaptation of the Nurturing Early Learners (NEL) framework for Kindergarten 1 (ages 4 to 5). Learning areas: Language and Literacy (children speak in simple sentences, recognise their written name, retell familiar stories); Numeracy (count reliably to ten, compare sizes, recognise simple patterns); Discovery of the World (observe living things closely, describe changes over time, care for plants and animals); Motor Skills (daily outdoor play, threading, pouring, cutting); Social and Emotional (take turns, express feelings in words); Aesthetics and Creative Expression (experiment with colour, texture and rhythm). Planning guidance: each week centres on one meaningful theme; balance teacher-guided and child-initiated experiences; daily outdoor time before 10:30am; at least two purposeful observation windows per week linked to learning outcomes.',
    now() - interval '180 days');

  r_template := pg_temp.seed_resource(v_centre, v_user,
    'Weekly Lesson Plan Template',
    'The centre''s standard five-day plan structure.',
    'lesson_template', false, 'weekly-lesson-plan-template.docx',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'Sunny Grove weekly lesson plan structure. Each week states: theme, class, weekly overview and 4 to 6 learning goals phrased as "Children will…" mapped to NEL learning areas. Daily rhythm: morning circle (welcome song, calendar, key question, theme words), main experience (one hands-on small-group activity with setup and teacher prompts), outdoor time before 10:30, story and rest, afternoon corners. Every plan ends with: a materials checklist grouped by day, two or three observation opportunities, wet-weather alternatives for outdoor blocks, and reflection prompts for the Friday team meeting.',
    now() - interval '160 days');

  r_observation := pg_temp.seed_resource(v_centre, v_user,
    'Observation Record Template',
    'Anecdotal observation format used across the centre.',
    'observation_template', false, 'observation-record-template.docx',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'Anecdotal observation record. Fields: child''s initials, date and time, setting, learning area, objective observation (what the child did and said, verbatim where possible), interpretation, next step. Guidance: observe for two to three minutes before writing; describe, do not evaluate; one meaningful observation is worth more than five rushed ones; link the next step to an upcoming week so it feeds back into planning.',
    now() - interval '150 days');

  r_sensory := pg_temp.seed_resource(v_centre, v_user,
    'Sensory Play Activity Bank',
    'Twelve low-preparation sensory experiences for 3–5 year olds.',
    'activity', false, 'sensory-play-activity-bank.pdf', 'application/pdf',
    'Sensory play activity bank for 3 to 5 year olds. Rainbow rice trays with scoops and funnels for pouring control. Water play station: basins with cups, sieves, sponges and floating objects; sink and float talk; rotate four children at a time with towels nearby. Nature texture boards with bark, leaves, seeds. Soil and seed exploration tubs with trowels and magnifiers. Playdough garden with green dough, silk flowers, pebbles. Ice rescue with warm water droppers. Sound bottles. Foam letters wash. Sand writing trays for pre-writing strokes. Smell pots with pandan, cinnamon, lemon, mint. Bubble wrap stomp painting outdoors. Mud kitchen with herbs. Safety: taste-safe materials for N1 and N2; check allergy list before smell pots; wipe floors around water stations.',
    now() - interval '90 days');

  r_policy := pg_temp.seed_resource(v_centre, v_user,
    'Outdoor Play & Sun Safety Policy',
    'When and how classes use the garden and playground.',
    'policy', false, 'outdoor-play-sun-safety-policy.pdf', 'application/pdf',
    'Outdoor play and sun safety policy. Every class has daily outdoor time scheduled before 10:30am to avoid peak heat. Check the weather reading before heading out; shorten outdoor time in shaded areas when heat stress is high. Hats for all children; shaded rest point available. Wet weather: at the first lightning alert or heavy rain, move indoors immediately; every weekly plan must include an indoor alternative for each outdoor block. The garden plot: K1 and K2 share the raised beds; child-sized tools are counted out and back in; hand-washing after all soil contact.',
    now() - interval '120 days');

  r_rainy := pg_temp.seed_resource(v_centre, v_user,
    'Rainy Day Indoor Activities',
    'Quick swaps for outdoor blocks during wet weather.',
    'activity', false, 'rainy-day-indoor-activities.docx',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'Indoor alternatives for wet-weather days; each swaps in for an outdoor block with no extra shopping. Movement: masking-tape balance lines, animal walk circuits, balloon keep-up, cushion obstacle course. Calm energy: rain-listening minute at the window, rain painting under the covered walkway drip line, thunderstorm counting game. Theme-friendly: indoor planting station on trays, sponge watering-can relay, garden yoga (grow from seed to tree), vegetable printing. Keep the same learning goal as the replaced outdoor block — the swap is of setting, not intent.',
    now() - interval '60 days');

  r_list := pg_temp.seed_resource(v_centre, v_user,
    'Little Gardeners Materials List',
    'Consumables and equipment for the gardening theme weeks.',
    'resource_list', false, 'little-gardeners-materials-list.xlsx', 'text/plain',
    'Little Gardeners materials list. In the store room: child trowels (12), watering cans (6), magnifying glasses (10), seed trays (8), plant markers (30), garden gloves (24), measuring tape ribbons (12), clipboards (12). To purchase each run: potting soil (2 bags), bean and marigold seeds (fast, reliable germination), egg cartons for seed starting, chart paper for growth charts, washable brown and green paint. Preparation notes: soak bean seeds the night before planting day; pre-fill seed trays for N classes; label watering cans by group colour.',
    now() - interval '14 days');

  r_puppet := pg_temp.seed_resource(v_centre, v_user,
    'Shadow Puppet Theatre',
    'Contributed activity — light, shadow and storytelling.',
    'activity', true, null, 'text/plain',
    'Shadow puppet theatre. Setup: white bedsheet across two chairs, lamp behind, room dimmed. Children cut animal and plant silhouettes from black card taped to satay sticks. Small groups of four behind the screen; start with "guess the shadow", then retell a familiar story. Quiet children speak more readily from behind the screen; big-shadow/small-shadow play sneaks in early science; retelling supports story sequencing. Extension: shadow hunt outdoors in morning light — trace a friend''s shadow with chalk and discuss why it moved.',
    now() - interval '26 hours');

  r_water := pg_temp.seed_resource(v_centre, v_user,
    'Water Play Stations',
    null,
    'activity', false, 'water-play-stations.docx',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'Water play stations for the classroom. Set up basins with cups, sieves, sponges, funnels and floating objects. Children rotate in groups of four. Talk about which objects sink and which float. Builds hand strength through squeezing sponges and pouring between containers. Keep towels nearby, wipe spills immediately, rotate children every ten minutes. Works well indoors on wet-weather days as a sensory alternative.',
    now() - interval '15 hours');

  -- Tag the headline resources (Atlas normally does this on upload).
  insert into public.resource_tags (resource_id, tag_id)
  select r_curriculum, id from public.tags where centre_id = v_centre and name in ('K1', 'Discovery of the World', 'Language & Literacy');
  insert into public.resource_tags (resource_id, tag_id)
  select r_template, id from public.tags where centre_id = v_centre and name in ('Template', 'K1', 'K2');
  insert into public.resource_tags (resource_id, tag_id)
  select r_sensory, id from public.tags where centre_id = v_centre and name in ('Sensory', 'Motor Skills', 'K1');
  insert into public.resource_tags (resource_id, tag_id)
  select r_policy, id from public.tags where centre_id = v_centre and name in ('Policy', 'Outdoor');
  insert into public.resource_tags (resource_id, tag_id)
  select r_rainy, id from public.tags where centre_id = v_centre and name in ('Motor Skills', 'K1', 'K2');
  insert into public.resource_tags (resource_id, tag_id)
  select r_list, id from public.tags where centre_id = v_centre and name in ('Nature', 'K1');
  insert into public.resource_tags (resource_id, tag_id)
  select r_puppet, id from public.tags where centre_id = v_centre and name in ('Aesthetics & Creative Expression', 'Language & Literacy', 'K1');
  insert into public.resource_tags (resource_id, tag_id)
  select r_water, id from public.tags where centre_id = v_centre and name in ('Sensory', 'Motor Skills', 'N2');

  -- ── Weekly plan (prepared by Atlas) ──────────────────────────────────────

  insert into public.weekly_plans (
    id, centre_id, week_start, week_end, theme, age_group, class_name,
    status, current_version, created_by
  ) values (
    v_plan, v_centre, v_monday, v_monday + 4,
    'Little Gardeners: How Plants Grow', 'K1', 'K1 Sunbeams', 'ready', 1, v_user
  );

  v_content := jsonb_build_object(
    'overview', 'This week the K1 Sunbeams become gardeners. Children plant bean and marigold seeds, learn the parts of a plant, and set up a growth chart they will return to all term. The week moves from wondering (what is inside a seed?) to doing (planting, watering) to noticing (first observations and measurements). Outdoor blocks use the garden plot before 10:30am in line with the sun safety policy.',
    'learningGoals', jsonb_build_array(
      'Children will name the basic parts of a plant — root, stem, leaf, flower, seed (Discovery of the World).',
      'Children will describe what seeds need to grow using words like soil, water, sunlight (Discovery of the World).',
      'Children will count and compare seeds and seedlings up to ten (Numeracy).',
      'Children will strengthen fine motor control through planting, pouring and tool use (Motor Skills).',
      'Children will take turns caring for a shared class garden (Social & Emotional).'
    ),
    'days', jsonb_build_array(
      jsonb_build_object('date', to_char(v_monday, 'YYYY-MM-DD'), 'label', 'Monday', 'title', 'What is a seed?', 'blocks', jsonb_build_array(
        jsonb_build_object('id', 'b-m1', 'period', 'morning', 'title', 'Morning circle — the mystery bag', 'description', 'Pass a cloth bag of mixed seeds around the circle. Children feel and guess before looking. Introduce the week''s key question: what is hiding inside a seed?', 'materials', jsonb_build_array('Mixed seeds in cloth bag', 'Word wall cards')),
        jsonb_build_object('id', 'b-m2', 'period', 'midday', 'title', 'Seed exploration tubs', 'description', 'Small groups examine bean seeds, marigold seeds and a coconut with magnifiers. Sort by size and colour into egg cartons.', 'materials', jsonb_build_array('Magnifying glasses', 'Egg cartons', 'Bean & marigold seeds')),
        jsonb_build_object('id', 'b-m3', 'period', 'afternoon', 'title', 'Story & seed dance', 'description', 'Read a growing story at rest time. Garden yoga: curl up as seeds, grow slowly into tall trees.', 'materials', jsonb_build_array('Growing-themed picture book'))
      )),
      jsonb_build_object('date', to_char(v_monday + 1, 'YYYY-MM-DD'), 'label', 'Tuesday', 'title', 'Planting day', 'blocks', jsonb_build_array(
        jsonb_build_object('id', 'b-t1', 'period', 'morning', 'title', 'Morning circle — how to plant', 'description', 'Demonstrate planting one bean step by step; children instruct the teacher and catch her mistakes. Sequence cards: soil, seed, cover, water, sun.', 'materials', jsonb_build_array('Sequence cards', 'Demo pot')),
        jsonb_build_object('id', 'b-t2', 'period', 'midday', 'title', 'Planting in the garden plot', 'description', 'Groups of four plant soaked bean seeds in the raised beds; each child also plants one seed in a labelled cup. Count seeds aloud. Wash hands after soil contact.', 'materials', jsonb_build_array('Soaked bean seeds', 'Potting soil', 'Trowels', 'Labelled cups', 'Watering cans')),
        jsonb_build_object('id', 'b-t3', 'period', 'afternoon', 'title', 'Playdough garden corner', 'description', 'Green dough, silk flowers and pebbles in the creative corner — children build miniature gardens and describe them.', 'materials', jsonb_build_array('Green playdough', 'Silk flowers', 'Pebbles'))
      )),
      jsonb_build_object('date', to_char(v_monday + 2, 'YYYY-MM-DD'), 'label', 'Wednesday', 'title', 'Roots, stems and leaves', 'blocks', jsonb_build_array(
        jsonb_build_object('id', 'b-w1', 'period', 'morning', 'title', 'Morning circle — parts of a plant', 'description', 'Reveal a real spring onion with roots. Name each part; children point to their own roots (feet), stem (body), leaves (arms) in the plant song.', 'materials', jsonb_build_array('Spring onion with roots', 'Plant parts poster')),
        jsonb_build_object('id', 'b-w2', 'period', 'midday', 'title', 'Celery colour experiment', 'description', 'Stand celery stalks in coloured water. Predict what will happen by Friday. Draw prediction pictures for the science wall.', 'materials', jsonb_build_array('Celery stalks', 'Food colouring', 'Clear cups')),
        jsonb_build_object('id', 'b-w3', 'period', 'afternoon', 'title', 'Vegetable printing', 'description', 'Print with halved okra, celery ends and peppers. Name the plant part being printed with each stamp.', 'materials', jsonb_build_array('Vegetables for printing', 'Washable paint', 'Paper rolls'))
      )),
      jsonb_build_object('date', to_char(v_monday + 3, 'YYYY-MM-DD'), 'label', 'Thursday', 'title', 'What do plants drink?', 'blocks', jsonb_build_array(
        jsonb_build_object('id', 'b-th1', 'period', 'morning', 'title', 'Morning circle — watering jobs', 'description', 'Set up the watering rota with group colour cards. Introduce "too much" and "too little" with two sad demo plants.', 'materials', jsonb_build_array('Rota chart', 'Group colour cards')),
        jsonb_build_object('id', 'b-th2', 'period', 'midday', 'title', 'Garden care & shadow hunt', 'description', 'Water the beds according to the rota, then chalk-trace shadows of the tallest plants and a friend. Return later to see the shadow move.', 'materials', jsonb_build_array('Watering cans', 'Chalk')),
        jsonb_build_object('id', 'b-th3', 'period', 'afternoon', 'title', 'Water play stations', 'description', 'Indoor water stations with cups, funnels and sponges — pouring practice linked to watering skills. Groups of four, ten-minute rotations.', 'materials', jsonb_build_array('Basins', 'Cups & funnels', 'Sponges', 'Towels'))
      )),
      jsonb_build_object('date', to_char(v_monday + 4, 'YYYY-MM-DD'), 'label', 'Friday', 'title', 'First growth check', 'blocks', jsonb_build_array(
        jsonb_build_object('id', 'b-f1', 'period', 'morning', 'title', 'Morning circle — celery reveal', 'description', 'Check the celery experiment against Wednesday''s predictions. Introduce the class growth chart for the term.', 'materials', jsonb_build_array('Growth chart', 'Celery from experiment')),
        jsonb_build_object('id', 'b-f2', 'period', 'midday', 'title', 'Measure & record', 'description', 'Groups check windowsill cups and garden beds with magnifiers, place ribbon markers at "how tall", and count how many cups show a sprout.', 'materials', jsonb_build_array('Magnifying glasses', 'Measuring ribbons')),
        jsonb_build_object('id', 'b-f3', 'period', 'afternoon', 'title', 'Show and tell — my seed diary', 'description', 'Each child shares one thing their seed did this week. Send seed diaries home with a note inviting families to water a plant together.', 'materials', jsonb_build_array('Seed diary sheets', 'Family note slips'))
      ))
    ),
    'materials', jsonb_build_array(
      jsonb_build_object('id', 'm-1', 'item', 'Bean seeds (soak Monday night)', 'detail', '2 per child + spares', 'day', 'Tuesday', 'ready', false),
      jsonb_build_object('id', 'm-2', 'item', 'Marigold seeds', 'detail', null, 'day', 'Monday', 'ready', true),
      jsonb_build_object('id', 'm-3', 'item', 'Potting soil', 'detail', '2 bags from store room', 'day', 'Tuesday', 'ready', true),
      jsonb_build_object('id', 'm-4', 'item', 'Child trowels & gloves', 'detail', 'count out and back in', 'day', 'Tuesday', 'ready', true),
      jsonb_build_object('id', 'm-5', 'item', 'Labelled planting cups', 'detail', 'write names Monday afternoon', 'day', 'Tuesday', 'ready', false),
      jsonb_build_object('id', 'm-6', 'item', 'Magnifying glasses (10)', 'detail', null, 'day', null, 'ready', true),
      jsonb_build_object('id', 'm-7', 'item', 'Celery, food colouring, clear cups', 'detail', null, 'day', 'Wednesday', 'ready', false),
      jsonb_build_object('id', 'm-8', 'item', 'Vegetables for printing', 'detail', 'okra, celery ends, peppers', 'day', 'Wednesday', 'ready', false),
      jsonb_build_object('id', 'm-9', 'item', 'Watering cans labelled by group colour', 'detail', null, 'day', 'Thursday', 'ready', true),
      jsonb_build_object('id', 'm-10', 'item', 'Growth chart & ribbon markers', 'detail', null, 'day', 'Friday', 'ready', true),
      jsonb_build_object('id', 'm-11', 'item', 'Seed diary sheets', 'detail', 'print 24', 'day', 'Friday', 'ready', false)
    ),
    'observationOpportunities', jsonb_build_array(
      jsonb_build_object('id', 'o-1', 'focus', 'Fine motor control (Motor Skills)', 'prompt', 'During Tuesday''s planting, watch how each child handles seeds and pours water — note pincer grip and pouring accuracy for two focus children.', 'day', 'Tuesday'),
      jsonb_build_object('id', 'o-2', 'focus', 'Scientific talk (Discovery of the World)', 'prompt', 'At the celery experiment, record the exact words children use to predict and explain. Listen for because, so and if.', 'day', 'Wednesday'),
      jsonb_build_object('id', 'o-3', 'focus', 'Turn-taking (Social & Emotional)', 'prompt', 'At the watering rota, observe how children negotiate whose turn it is and how they respond when asked to wait.', 'day', 'Thursday')
    ),
    'rainyDayAlternatives', jsonb_build_array(
      jsonb_build_object('id', 'rd-1', 'title', 'Indoor planting station', 'description', 'If Tuesday''s garden block is rained off, move planting to trays on the covered walkway tables — same sequence cards, same counting.', 'replaces', 'Tuesday — Planting in the garden plot'),
      jsonb_build_object('id', 'rd-2', 'title', 'Rain-listening & watering relay', 'description', 'Swap Thursday''s garden care for a rain-listening minute at the window, then a sponge watering relay indoors.', 'replaces', 'Thursday — Garden care & shadow hunt')
    ),
    'reflectionPrompts', jsonb_build_array(
      'Which children surprised you at the planting beds, and how might next week''s garden jobs stretch them?',
      'Did the celery experiment predictions spark cause-and-effect talk? Capture two quotes for the science wall.',
      'Was the watering rota calm or contested? Adjust group sizes before this becomes the daily routine.'
    ),
    'sources', jsonb_build_array(
      jsonb_build_object('resourceId', r_curriculum::text, 'title', 'NEL Curriculum Guide — Kindergarten 1', 'usage', 'Learning goals aligned to K1 outcomes for Discovery of the World, Numeracy, Motor Skills and Social & Emotional development.'),
      jsonb_build_object('resourceId', r_template::text, 'title', 'Weekly Lesson Plan Template', 'usage', 'Daily rhythm and the checklist/observation/reflection structure follow the centre template.'),
      jsonb_build_object('resourceId', r_list::text, 'title', 'Little Gardeners Materials List', 'usage', 'Materials checklist drawn from the store-room inventory, including the seed-soaking preparation note.'),
      jsonb_build_object('resourceId', r_sensory::text, 'title', 'Sensory Play Activity Bank', 'usage', 'Playdough garden, soil exploration tubs and Thursday''s water play stations adapted from the activity bank.'),
      jsonb_build_object('resourceId', r_policy::text, 'title', 'Outdoor Play & Sun Safety Policy', 'usage', 'Garden blocks scheduled before 10:30am; hand-washing after soil contact; wet-weather swap rules.'),
      jsonb_build_object('resourceId', r_rainy::text, 'title', 'Rainy Day Indoor Activities', 'usage', 'Rainy-day alternatives adapted from the indoor swaps collection.')
    )
  );

  insert into public.weekly_plan_versions (
    weekly_plan_id, version_number, content, change_summary, created_by_atlas
  ) values (
    v_plan, 1, v_content,
    'Atlas prepared this week from your curriculum and 6 centre resources.', true
  );

  -- ── Atlas Feed ────────────────────────────────────────────────────────────

  insert into public.atlas_feed_items
    (centre_id, type, title, summary, review_minutes, action_label, action_href, event, metadata, created_at)
  values
    (v_centre, 'week_ready',
     'Week of ' || to_char(v_monday, 'DD Mon') || ' is ready',
     'Atlas prepared "Little Gardeners: How Plants Grow" for K1 Sunbeams using your curriculum guide and 5 other centre resources.',
     6, 'Review the week', '/week/' || v_plan, 'weekly_plan_generated',
     jsonb_build_object('planId', v_plan::text), now() - interval '11 hours'),
    (v_centre, 'materials_ready',
     'Materials checklist prepared',
     '11 items for the week — 4 need preparing ahead, including bean seeds to soak on Monday night.',
     2, 'Check materials', '/week/' || v_plan || '#materials', 'weekly_plan_generated',
     jsonb_build_object('planId', v_plan::text), now() - interval '11 hours'),
    (v_centre, 'observations_ready',
     '3 observation opportunities found',
     'Moments this week suit fine-motor, scientific-talk and turn-taking observations — matched to your observation record template.',
     2, 'See opportunities', '/week/' || v_plan || '#observations', 'weekly_plan_generated',
     jsonb_build_object('planId', v_plan::text), now() - interval '11 hours'),
    (v_centre, 'weather_adjustment',
     'Thunderstorms likely Thursday afternoon',
     'Atlas added indoor alternatives for Thursday''s garden block, adapted from your rainy-day collection.',
     1, 'See alternatives', '/week/' || v_plan || '#rainy-day', 'weekly_plan_updated',
     jsonb_build_object('planId', v_plan::text, 'demo', true), now() - interval '5 hours'),
    (v_centre, 'resources_added',
     '2 new resources in Centre Intelligence',
     '"Shadow Puppet Theatre" was contributed and "Water Play Stations" was uploaded. Both are classified and searchable.',
     1, 'Browse the library', '/centre', 'teacher_contributed_resource',
     jsonb_build_object('resourceIds', jsonb_build_array(r_puppet::text, r_water::text)), now() - interval '14 hours'),
    (v_centre, 'duplicate_found',
     '"Water Play Stations" looks similar to an existing resource',
     'It overlaps with "Sensory Play Activity Bank". You can merge them, keep both as a fork, or keep them separate.',
     2, 'Compare', '/review', 'duplicate_detected',
     jsonb_build_object('newResourceId', r_water::text, 'existingResourceId', r_sensory::text, 'similarity', 0.58),
     now() - interval '15 hours');

  -- ── Contribution history ──────────────────────────────────────────────────

  insert into public.contribution_events (centre_id, user_id, resource_id, event_type, created_at) values
    (v_centre, v_user, r_puppet, 'contributed', now() - interval '26 hours'),
    (v_centre, v_user, r_water, 'uploaded', now() - interval '15 hours'),
    (v_centre, v_user, r_list, 'uploaded', now() - interval '14 days');

  raise notice 'Seed complete: Sunny Grove Preschool (centre %) attached to user %', v_centre, v_user;
end $$;
